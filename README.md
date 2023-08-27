# phiti - Philadelphia Graffiti Explorer
phiti is a web application designed to explore Phildelphia's **graffiti-removal** images based on location and area, using data from Philly311.

View the public git page here: **https://jeisey.github.io/phiti/**

**phiti**: a blend of "Philadelphia" and "Graffiti"; sounds like "fih-TEE". 

## Features

- Dynamic loading of graffiti images based on ZIP code.
- Filtering of images based on area.
- Modern and responsive design suitable for desktop and mobile viewing.

## Usage

1. **Select an Area**: Use the dropdown menu to select a specific area.
2. **Select a ZIP Code**: Based on the chosen area, select a ZIP code from the dropdown menu.
3. **Select Open/Closed Requests**: Based on your selection, the images will be filtered to Closed, Open, or Both (default)
4. **View Image**: Click the "View Image" button to load a random graffiti image from the selected ZIP code.

## Data Source

The graffiti images and data are sourced from Philly311.
Data is refreshed every Monday at Midnight via API (https://cityofphiladelphia.github.io/carto-api-explorer/#public_cases_fc) using the Github Actions worflow

## Why?

Mini-hackathon on a friday night

## Credits

- **Design & Development**: Jesse & Daniel
- **Data Sources**:
  - Philly311 (https://data.phila.gov/visualizations/311-requests/)
  - Prison Policy Initiative ( https://www.prisonpolicy.org/origin/pa/2020/philadelphia.html)
