import pandas as pd
import requests
from datetime import datetime

# Step 1: Fetch current dataset from GitHub
url = "https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv"
current_data = pd.read_csv(url, parse_dates=['requested_datetime', 'closed_datetime'], encoding='latin1')

# Step 2: Find the most recent requested_datetime
latest_date = current_data['requested_datetime'].max()
latest_date = latest_date.tz_convert('UTC')

# Step 3: Query the API for new or modified records
query = f"""
SELECT cartodb_id,objectid,service_request_id,status,status_notes,requested_datetime,updated_datetime,expected_datetime,closed_datetime,address,zipcode,media_url,lat,lon 
FROM public_cases_fc 
WHERE 
      ( 
        (requested_datetime > '{latest_date}') OR 
        (status = 'Open' AND closed_datetime IS NOT NULL)
      ) 
      AND subject = 'Graffiti Removal'
      AND media_url IS NOT NULL
      AND media_url <> ''
"""
response = requests.get("https://phl.carto.com/api/v2/sql", params={'q': query})
new_data = pd.DataFrame(response.json()['rows'])
new_data['requested_datetime'] = pd.to_datetime(new_data['requested_datetime'])

# Step 4: Perform upsert operation
# Update modified records
mask = (current_data['status'] == 'Open') & (current_data['closed_datetime'].isna())

# Merge datasets on unique identifier
merged_data = pd.merge(current_data, new_data[['cartodb_id', 'closed_datetime', 'status_notes']], on='cartodb_id', how='left', suffixes=('', '_new'))

# Update the closed_datetime for "Open" status records
mask = (merged_data['status'] == 'Open') & (merged_data['closed_datetime'].isna()) & (merged_data['closed_datetime_new'].notna())
merged_data.loc[mask, 'closed_datetime'] = merged_data.loc[mask, 'closed_datetime_new']

# Update the status_notes for these records
merged_data.loc[mask, 'status_notes'] = merged_data.loc[mask, 'status_notes_new']

# Drop the additional columns introduced due to merging
merged_data.drop(columns=['closed_datetime_new', 'status_notes_new'], inplace=True)

# Replace current_data with merged_data for further processing
current_data = merged_data

# Append new records
new_records = new_data[~new_data['cartodb_id'].isin(current_data['cartodb_id'])]
current_data = pd.concat([current_data, new_records], ignore_index=True)

# Step 5: Recalculate time_to_close column
current_date = pd.Timestamp.now(tz='UTC')

# Ensure both columns are parsed as datetime objects
current_data['closed_datetime'] = pd.to_datetime(current_data['closed_datetime'], errors='coerce', utc=True)
current_data['requested_datetime'] = pd.to_datetime(current_data['requested_datetime'], utc=True)

# Handle potential NaN values in closed_datetime
filled_closed_datetime = pd.to_datetime(current_data['closed_datetime'].fillna(current_date))
# Calculate time_to_close
current_data['time_to_close'] = (filled_closed_datetime - current_data['requested_datetime']).dt.days

# Load the reference file for area update
ref_url = "https://raw.githubusercontent.com/jeisey/phiti/main/ref_ziparea.csv"
ref_data = pd.read_csv(ref_url)


# Ensure both columns used for merging are of the same data type
current_data['zipcode'] = current_data['zipcode'].astype(str)
ref_data['Zip'] = ref_data['Zip'].astype(str)

# Join the current data with the reference data on zipcode to update the area column

# Convert 'zipcode' to string and then strip any trailing '.0'
current_data['zipcode'] = current_data['zipcode'].astype(str).str.rstrip('.0')

# Drop rows with invalid zip codes
invalid_zips = ['1920', '196139', 'None', 'nan']
current_data = current_data[~current_data['zipcode'].isin(invalid_zips)]

current_data = current_data.merge(ref_data[['Zip', 'District']], left_on='zipcode', right_on='Zip', how='left')
current_data['area'] = current_data['District'].fillna("Not Applicable")
current_data.drop(columns=['Zip', 'District'], inplace=True)  # Drop the columns used for the merge

# Save the updated dataframe (pushed to git repository)
current_data.to_csv("graffiti.csv", index=False)
