import pandas as pd
import requests
from datetime import datetime

# Step 1: Fetch current dataset from GitHub
url = "https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv"
current_data = pd.read_csv(url, parse_dates=['requested_datetime', 'closed_datetime'])

# Step 2: Find the most recent requested_datetime
latest_date = current_data['requested_datetime'].max()

# Step 3: Query the API for new or modified records
query = f"""
SELECT * 
FROM public_cases_fc 
WHERE requested_datetime > '{latest_date}' OR 
      (status = 'Open' AND closed_datetime IS NOT NULL)
"""
response = requests.get("https://phl.carto.com/api/v2/sql", params={'q': query})
new_data = pd.DataFrame(response.json()['rows'])

# Step 4: Perform upsert operation
# Update modified records
mask = (current_data['status'] == 'Open') & (current_data['closed_datetime'].isna())
current_data.loc[mask, 'closed_datetime'] = new_data.loc[new_data['status'] == 'Open', 'closed_datetime']

# Append new records
new_records = new_data[new_data['requested_datetime'] > latest_date]
current_data = current_data.append(new_records, ignore_index=True)

# Step 5: Recalculate time_to_close column
current_date = datetime.now()
current_data['time_to_close'] = (current_data['closed_datetime'].fillna(current_date) - current_data['requested_datetime']).dt.days

# Save the updated dataframe (this can be pushed back to GitHub or saved locally)
current_data.to_csv("graffiti.csv", index=False)

