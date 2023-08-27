let zipCodeMedia = {};
let graffitiData = []; // To store the entire processed dataset
let areaToZip = {}; // To store the mapping of areas to their associated zip codes
let allZips = new Set(); // To store all unique zip codes from the reference data

// Fetch the reference data for area-to-zipcode mapping
fetch('https://raw.githubusercontent.com/jeisey/phiti/main/ref_ziparea.csv')
    .then(response => response.text())
    .then(data => {
        const rows = data.split('\n');
        const areaDropdown = document.getElementById('area'); // interchangeable with 'area'
        const zipDropdown = document.getElementById('zipcode');

        rows.forEach(row => {
            const columns = row.split(',');
            const area = columns[1]; // interchangeable with Neighborhood [2] when toggling the document.getElementById('infoArea').textContent = randomEntry.Neighborhood
            const zipcode = columns[0];

            // Store all unique zip codes
            allZips.add(zipcode);
            allZips = new Set([...allZips].sort((a, b) => parseInt(a) - parseInt(b)));


            if (!areaToZip[area]) {
                areaToZip[area] = [];
                // Create an option for the area
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                areaDropdown.appendChild(option);
            }
            areaToZip[area].push(zipcode);
        });

        // Initially populate the zip dropdown with all zip codes
        allZips.forEach(zip => {
            const option = document.createElement('option');
            option.value = zip;
            option.textContent = zip;
            zipDropdown.appendChild(option);
        });
    });

// Function to update the Zip dropdown based on the selected area
function updateZipDropdown(selectedArea) {
    const zipDropdown = document.getElementById('zipcode');
    // Clear all existing options
    while (zipDropdown.firstChild) {
        zipDropdown.removeChild(zipDropdown.firstChild);
    }
    
    // If an area is selected, filter by the area; otherwise, show all available zip codes
    const zipsToShow = selectedArea ? areaToZip[selectedArea] : Array.from(allZips);
    zipsToShow.sort((a, b) => parseInt(a) - parseInt(b));

    
    zipsToShow.forEach(zip => {
        const option = document.createElement('option');
        option.value = zip;
        option.textContent = zip;
        zipDropdown.appendChild(option);
    });
}

// Event listener to update the zip dropdown when an area is selected
document.getElementById('area').addEventListener('change', function() {
    updateZipDropdown(this.value || null);
});


// Fetch the CSV data from GitHub (replace with your actual raw GitHub link)
fetch('https://raw.githubusercontent.com/jeisey/phiti/main/graffiti.csv')
    .then(response => response.text())
    .then(data => {
        const rows = data.split('\n');
        rows.forEach(row => {
            const columns = row.split(',');
            const zipcode = columns[10];
            const media_url = columns[11];
            const area = columns[15]; // relabel if more clarity needed between area and neighborhood

            if (!zipCodeMedia[zipcode]) {
                zipCodeMedia[zipcode] = [];
            }
            zipCodeMedia[zipcode].push(media_url);

            // Store the entire row data for displaying details later
            graffitiData.push({
                zipcode: zipcode,
                media_url: media_url,
                area: area,
                time_to_close: columns[14],
                requested_datetime: columns[5],
                address: columns[9],
                status: columns[3],
                status_notes: columns[4]
            });
        });
    })
    .catch(error => {
        console.error('Error fetching the CSV:', error);
    });

document.getElementById('viewImage').addEventListener('click', function() {
    const zipCode = document.getElementById('zipcode').value;
    const imageContainer = document.getElementById('graffitiImage');

    const closedStatusChecked = document.getElementById('closedStatus').checked;
    const openStatusChecked = document.getElementById('openStatus').checked;

    const instructionContainer = document.querySelector('.instruction-container');

    instructionContainer.style.display = 'none';

    
    const filteredData = graffitiData.filter(item => item.zipcode === zipCode);
    if (filteredData.length > 0) {
        
const filteredByStatus = filteredData.filter(img => {
    if (closedStatusChecked && img.status === 'Closed') return true;
    if (openStatusChecked && img.status === 'Open') return true;
    return false;
});


if (filteredByStatus.length === 0) {
    const closedCount = filteredData.filter(img => img.status === 'Closed').length;
    const openCount = filteredData.filter(img => img.status === 'Open').length;
    alert(`No images match the selected criteria. There are ${closedCount} Closed Requests and ${openCount} Open Requests. Please adjust your filters and try again.`);
    return;
}

const randomEntry = filteredByStatus[Math.floor(Math.random() * filteredByStatus.length)];

        // Update the image container's source and make it visible
        imageContainer.src = randomEntry.media_url;
        imageContainer.hidden = false;

        // Display the selected graffiti details
        document.getElementById('infoArea').textContent = randomEntry.area; //swap to area
        // document.getElementById('infoArea').textContent = randomEntry.Neighborhood; // or the appropriate property name that represents the "Neighborhood" in your processed graffiti data.
        document.getElementById('infoZipcode').textContent = randomEntry.zipcode;
        document.getElementById('infoTimeToClose').textContent = randomEntry.time_to_close;
        document.getElementById('infoDateReported').textContent = randomEntry.requested_datetime;
        document.getElementById('infoAddress').textContent = randomEntry.address;
        document.getElementById('infoStatus').textContent = randomEntry.status;

const closedCount = filteredData.filter(img => img.status === 'Closed').length; 
const openCount = filteredData.filter(img => img.status === 'Open').length;
document.getElementById('statusCounts').textContent = `(${closedCount}) Closed | (${openCount}) Open`;


        document.getElementById('infoStatusNotes').textContent = randomEntry.status_notes;

    } else {
        alert('No graffiti image found for the selected zip code.');
    }
});
