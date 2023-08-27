import pandas as pd
import requests
from datetime import datetime

# Step 1: Fetch current dataset from GitHub
url = "https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv"
current_data = pd.read_csv(url, parse_dates=['requested_datetime', 'closed_datetime'], encoding='latin1')


# Step 2: Find the most recent requested_datetime
latest_date = current_data['requested_datetime'].max()
latest_date = latest_date.tz_localize('UTC')

# Step 3: Query the API for new or modified records
query = f"""
SELECT cartodb_id,objectid,service_request_id,status,status_notes,requested_datetime,updated_datetime,expected_datetime,closed_datetime,address,zipcode,media_url,lat,lon 
FROM public_cases_fc 
WHERE requested_datetime > '{latest_date}' OR 
      (status = 'Open' AND closed_datetime IS NOT NULL)
      and subject = 'Graffiti Removal'
      and media_url IS NOT NULL
"""
response = requests.get("https://phl.carto.com/api/v2/sql", params={'q': query})
new_data = pd.DataFrame(response.json()['rows'])
new_data['requested_datetime'] = pd.to_datetime(new_data['requested_datetime'])


# Step 4: Perform upsert operation
# Update modified records
mask = (current_data['status'] == 'Open') & (current_data['closed_datetime'].isna())

# Merge datasets on unique identifier
merged_data = pd.merge(current_data, new_data[['cartodb_id', 'closed_datetime']], on='cartodb_id', how='left', suffixes=('', '_new'))

# Update the closed_datetime for "Open" status records
mask = (merged_data['status'] == 'Open') & (merged_data['closed_datetime'].isna()) & (merged_data['closed_datetime_new'].notna())
merged_data.loc[mask, 'closed_datetime'] = merged_data.loc[mask, 'closed_datetime_new']

# Drop the additional columns introduced due to merging
merged_data.drop(columns=['closed_datetime_new'], inplace=True)

# Replace current_data with merged_data for further processing
current_data = merged_data


# Append new records
new_records = new_data[new_data['requested_datetime'] > latest_date]

# Exclude records from new_data that have a cartodb_id already present in current_data
new_records = new_data[~new_data['cartodb_id'].isin(current_data['cartodb_id'])]
current_data = pd.concat([current_data, new_records], ignore_index=True)


# Step 5: Recalculate time_to_close column
current_date = pd.Timestamp.now(tz='UTC')

# Ensure both columns are parsed as datetime objects

# Ensure 'closed_datetime' is parsed as a datetime object
current_data['closed_datetime'] = pd.to_datetime(current_data['closed_datetime'], errors='coerce', utc=True)


# Ensure 'requested_datetime' is parsed as a datetime object with UTC
current_data['requested_datetime'] = pd.to_datetime(current_data['requested_datetime'], utc=True)



# Convert datetime columns to proper datetime format
current_data['requested_datetime'] = pd.to_datetime(current_data['requested_datetime'], errors='coerce', utc=True)
current_data['closed_datetime'] = pd.to_datetime(current_data['closed_datetime'], errors='coerce', utc=True)

# Handle potential NaN values in closed_datetime


# Fill NaN values and ensure the result is a DatetimeArray
filled_closed_datetime = pd.to_datetime(current_data['closed_datetime'].fillna(current_date))

current_data['time_to_close'] = (filled_closed_datetime - current_data['requested_datetime']).dt.days


# # Save the updated dataframe (this can be pushed back to GitHub or saved locally)
current_data.to_csv("graffiti.csv", index=False)

