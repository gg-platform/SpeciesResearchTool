# Species Research Tool

**Discover local wildlife records — faster**

Welcome to the Species Research Tool! This lightweight, experimental web app helps you explore biodiversity records and spot patterns in your area.

---

## What you can do

- **Fetch records:** Paste an API link from the [NBN Atlas spatial search](https://records.nbnatlas.org/search#tab_spatialSearch) and quickly download wildlife occurrence data for your chosen area.
- **Overview:** Instantly see charts and tables showing activity by month, taxonomic class, data providers, and more.
- **BoCC Comparison:** Match your results with the Birds of Conservation Concern 5 (BoCC) reference lists.
- **Interactive Map:** Visualize records on a map using OpenStreetMap and Leaflet, with easy clustering for large datasets.

---

## How to use

1. Go to the [NBN Atlas Spatial Search](https://records.nbnatlas.org/search#tab_spatialSearch).
2. Draw a polygon or import a GIS area to define your region.
3. Run the search, then click **API** (top-right) and copy the **JSON web service API** URL.
4. Paste the URL into the Species Research Tool and click **Fetch**.
5. Explore your data in the Overview, BoCC Analysis, Reference, and Map tabs.

---

## Technical Information

- **Data Fetching:** The tool retrieves occurrence records in JSON format directly from the NBN Atlas API using the provided URL.
- **Data Processing:** Records are parsed and grouped by key fields such as date, taxonomic class, and data provider. The app summarizes counts, filters duplicates, and extracts relevant metadata.
- **BoCC Comparison:** For bird records, the tool cross-references species names with the Birds of Conservation Concern 5 (BoCC) list to highlight conservation status.
- **Visualization:** Data is displayed using interactive charts (e.g., bar charts by month/class/provider) and a map powered by Leaflet and OpenStreetMap. Large datasets are clustered for performance.
- **Privacy:** No data is stored on a server; all processing happens in your browser session.

---

## Disclaimer

This software is provided **"AS IS"** without warranty of any kind. Use is governed by the MIT License.

---

Enjoy exploring biodiversity data!