const resultDiv = document.getElementById('ResultDiv');
const ageDropdown = document.getElementById('AgeDropdown');
const stateDropdown = document.getElementById('StateDropdown');
const districtDropdown = document.getElementById('DistrictDropdown');
const pincodeTextBox = document.getElementById('PincodeTextBox');
const dateTextBox = document.getElementById('DateTextBox');
const resultTable = document.getElementById('ResultTable');

/* Switch between Authenticated/Non-authenticated request */
const token = '';
const public = token ? '' : 'public/';

function loadStateDropdown() {
  fetch('https://cdn-api.co-vin.in/api/v2/admin/location/states')
    .then(response => response.json())
    .then(data => {
      data.states.forEach(state => {
        const option = document.createElement('option');
        option.value = state.state_id;
        option.innerHTML = state.state_name;
        stateDropdown.appendChild(option);
      });
    });
}

function loadDistrictDropdown() {
  districtDropdown.innerHTML = '';
  const stateId = stateDropdown.value;

  fetch(`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${stateId}`)
    .then(response => response.json())
    .then(data => {
      data.districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district.district_id;
        option.innerHTML = district.district_name;
        districtDropdown.appendChild(option);
      });
    });
}

function getSlotsByPinCode(pincode, date, ageLimit) {
  let url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/${public}calendarByPin?pincode=${pincode}&date=${date}`;
  getAvailableVaccineSlots(url, ageLimit);
}

function getSlotsByDistrict(districtId, date, ageLimit) {
  let url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/${public}calendarByDistrict?district_id=${districtId}&date=${date}`;
  getAvailableVaccineSlots(url, ageLimit);
}

function getAvailableVaccineSlots(url, ageLimit) {
  const header = new Headers({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  });
  
  fetch(url, {
    headers: header,
    method: 'GET'
  })
    .then(response => {
			if (!response.ok) {
				throw Error(
					JSON.stringify({
						ResponseStatus: response.status,
						ResponseStatusText: response.statusText
					})
				);
			}

			return response.json();
		})
    .then(data => {
      let centersWithAvailableSlots = data.centers.filter(c => c.sessions.some(s => s.min_age_limit === ageLimit && s.available_capacity > 0));
      let result = [];

      centersWithAvailableSlots.forEach(element => {
        let availableSlots = element.sessions.filter(s => s.min_age_limit === ageLimit && s.available_capacity > 0);

        if (availableSlots.length > 0) {
          result.push({
            District: element.district_name,
            City: element.block_name,
            Center: element.name,
            Pincode: element.pincode,
            Address: element.address,
            Age: ageLimit,
            Payment: element.fee_type,
            Slots: availableSlots.map(s => {
              return {
                Date: s.date,
                Available: s.available_capacity,
                Timing: s.slots.join(', '),
                Vaccine: s.vaccine
              }
            })
          });
        }
      });

      if (result.length == 0) {
        resultDiv.innerHTML = 'No slots found!';
      }
      else {
        const startDate = new Date(getInputDate());

        // Add header row
        resultTable.insertRow(0);

        // Center Name
        resultTable.rows[0].appendChild(document.createElement("th"));
        resultTable.rows[0].cells[0].innerHTML = 'Center';

        // Add columns for each day in a 
        // full week starting from input date
        for (let i = 0; i < 7; i++) {
          startDate.setDate(startDate.getDate() + (i == 0 ? i : 1));
          resultTable.rows[0].appendChild(document.createElement("th"));
          resultTable.rows[0].cells[i + 1].innerHTML = getFormattedDate(startDate);
        }

        let rowNumber = 1;
        result.forEach(r => {
          resultTable.insertRow(rowNumber);

          // Center
          resultTable.rows[rowNumber].insertCell();
          resultTable.rows[rowNumber].cells[0].innerHTML = `<span class='center'>${r.Center}</span> <span class='${r.Payment.toLowerCase()}'>${r.Payment.toUpperCase() === 'PAID' ? 'PAID' : ''}</span> <br/> <span class='address'>${r.Address}, ${r.Pincode}</span>`;
          resultTable.rows[rowNumber].cells[0].className = 'center';

          // Default values for available slots
          for (let i = 0; i < 7; i++) {
            resultTable.rows[rowNumber].insertCell();
            resultTable.rows[rowNumber].cells[i + 1].innerHTML = '--';
          }

          // Set available slots
          r.Slots.forEach(s => {
            for (let i = 1; i < resultTable.rows[0].cells.length; i++) {
              if (Date.parse(resultTable.rows[0].cells[i].innerHTML) === Date.parse(s.Date)) {
                resultTable.rows[rowNumber].cells[i].innerHTML = `<span class='available'>${s.Available}</span> <span>${s.Vaccine}</span>`;
                resultTable.rows[rowNumber].cells[i].className = 'slot';
              }
            };
          });

          rowNumber += 1;
        });
      }
    })
    .catch(error => {
      error = JSON.parse(error.message);
      if (error.hasOwnProperty('ResponseStatus')) {
        if (error.ResponseStatus === 401)
          alert('Session expired');
      }
    });
}

function setCurrentDate() {
  const date = new Date();
  dateTextBox.value = `${date.getFullYear()}-${padLeft((date.getMonth() + 1), 2, '0')}-${padLeft(date.getDate(), 2, '0')}`;
}

function padLeft(stringValue, length, paddingCharacter) {
  stringValue = stringValue.toString();
  
  while (stringValue.length < length)
    stringValue = paddingCharacter + stringValue;
  
  return stringValue;
}

function getInputDate() {
  let inputDate = Date.parse(dateTextBox.value);

  if (isNaN(inputDate)) {
    alert('Please enter a valid date');
    return null;
  }
  else {
    inputDate = new Date(dateTextBox.value);
  }

  return getFormattedDate(inputDate);
}

function getFormattedDate(date) {  
  return `${padLeft(date.getDate(), 2, '0')}-${padLeft((date.getMonth() + 1), 2, '0')}-${date.getFullYear()}`;
}

function getDateHeader(date) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

function clearResult() {
  resultDiv.innerHTML = '';
  resultTable.innerHTML = '';
}

function searchByDistrict() {
  clearResult();
  const age = parseInt(ageDropdown.value);
  const districtId = parseInt(districtDropdown.value);
  const date = getInputDate();

  if (isNaN(districtId) || districtId === 0) {
    alert('Please select district');
    return;
  }

  if (!date)
    return;

  getSlotsByDistrict(districtId, date, age);
}

function searchByPincode() {
  clearResult();
  const age = parseInt(ageDropdown.value);
  const pincode = parseInt(PincodeTextBox.value);
  const date = getInputDate();

  if (isNaN(pincode) || pincode === 0) {
    alert('Please enter pincode');
    return;
  }

  if (!date)
    return;

  getSlotsByPinCode(pincode, date, age);
}

loadStateDropdown();
setCurrentDate();