const resultDiv = document.getElementById('ResultDiv');
const ageDropdown = document.getElementById('AgeDropdown');
const doseDropdown = document.getElementById('DoseDropdown');
const stateDropdown = document.getElementById('StateDropdown');
const districtDropdown = document.getElementById('DistrictDropdown');
const pincodeTextBox = document.getElementById('PincodeTextBox');
const dateTextBox = document.getElementById('DateTextBox');
const resultTable = document.getElementById('ResultTable');
const totalSlotsSpan = document.getElementById('TotalSlots');
const districtNameSpan = document.getElementById('District');

const DAYS_IN_WEEK = 7;
let totalSlots = 0;

let searchResult = [];

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

function getSlotsByPinCode(pincode, date) {
	let url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/${public}calendarByPin?pincode=${pincode}&date=${date}`;
	getAvailableVaccineSlots(url);
}

function getSlotsByDistrict(districtId, date) {
	let url = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/${public}calendarByDistrict?district_id=${districtId}&date=${date}`;
	getAvailableVaccineSlots(url);
}

function getAvailableVaccineSlots(url) {
	searchResult = [];
	totalSlots = 0;
	const header = new Headers({
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
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
			let centersWithAvailableSlots = data.centers.filter(c =>
				c.sessions.some(
					s => s.available_capacity_dose1 > 0 || s.available_capacity_dose2 > 0
				)
			);

			centersWithAvailableSlots.forEach(element => {
				let availableSlots = element.sessions.filter(
					s => s.available_capacity_dose1 > 0 || s.available_capacity_dose2 > 0
				);

				if (availableSlots.length > 0) {
					searchResult.push({
						District: element.district_name,
						City: element.block_name,
						Center: element.name,
						Pincode: element.pincode,
						Address: element.address,
						Payment: element.fee_type,
						Slots: availableSlots.map(s => {
							return {
								Date: s.date,
								Available_Dose1: s.available_capacity_dose1,
								Available_Dose2: s.available_capacity_dose2,
								Timing: s.slots.join(', '),
								Vaccine: s.vaccine,
								Age: s.min_age_limit
							};
						})
					});
				}
			});

			drawResultTable();
		})
		.catch(error => {
			error = JSON.parse(error.message);
			if (error.hasOwnProperty('ResponseStatus')) {
				if (error.ResponseStatus === 401) alert('Session expired');
			}
		});
}

function drawResultTable() {
	clearResult();
	// Selected age
	const ageLimit = parseInt(ageDropdown.value);
	// Selected Dose
	const selectedDose = doseDropdown.value;
	// Filter result by age and atleast one slot exists, for selected dose, where vaccine is available
	const filterData = searchResult.filter(result =>
		result.Slots.some(
			slot =>
				slot.Age === ageLimit &&
				((selectedDose === '1' && slot.Available_Dose1 > 0) ||
					(selectedDose === '2' && slot.Available_Dose2 > 0))
		)
	);

	if (filterData.length == 0) {
		resultDiv.innerHTML = 'No slots found!';
		return;
	}

	const startDate = new Date(dateTextBox.value);

	// Add header row
	resultTable.insertRow(0);

	// Center Name
	resultTable.rows[0].appendChild(document.createElement('th'));
	resultTable.rows[0].cells[0].innerHTML = 'Center';

	// Add columns for each day in a
	// full week starting from input date
	for (let i = 0; i < DAYS_IN_WEEK; i++) {
		startDate.setDate(startDate.getDate() + (i == 0 ? i : 1));
		resultTable.rows[0].appendChild(document.createElement('th'));
		resultTable.rows[0].cells[i + 1].innerHTML = getHeaderDate(startDate);
	}

	let rowNumber = 1;
	filterData.forEach(r => {
		resultTable.insertRow(rowNumber);

		// Center
		resultTable.rows[rowNumber].insertCell();
		resultTable.rows[rowNumber].cells[0].innerHTML = `<span class='center'>${
			r.Center
		}</span> <span class='${r.Payment.toLowerCase()}'>${
			r.Payment.toUpperCase() === 'PAID' ? 'PAID' : ''
		}</span> <br/> <span class='address'>${r.Address}, ${r.Pincode}</span>`;
		resultTable.rows[rowNumber].cells[0].className = 'center';

		// Default values for available slots
		for (let i = 0; i < DAYS_IN_WEEK; i++) {
			resultTable.rows[rowNumber].insertCell();
			resultTable.rows[rowNumber].cells[i + 1].innerHTML = '--';
		}

		// Set available slots
		r.Slots.filter(
			slot =>
				(selectedDose === '1' && slot.Available_Dose1 > 0) ||
				(selectedDose === '2' && slot.Available_Dose2 > 0)
		).forEach(s => {
			for (let i = 1; i < resultTable.rows[0].cells.length; i++) {
				const headerDate = new Date(resultTable.rows[0].cells[i].innerHTML);

				// Date in results is not in a standard UTC format.
				// So we must split it with assumptions on format(ddMMyyyy) to get actual date.
				const slotDateFields = s.Date.split('-');
				const slotDate = new Date(
					parseInt(slotDateFields[2]),
					parseInt(slotDateFields[1]) - 1,
					parseInt(slotDateFields[0])
				);

				if (headerDate.getTime() === slotDate.getTime()) {
					let dailyAvailable = '';

					// Slot 1
					if (selectedDose === '1') {
						totalSlots += parseInt(s.Available_Dose1);
						dailyAvailable = `<span class='available'>${s.Available_Dose1}</span>`;
						dailyAvailable += `<div class='vaccine'>${s.Vaccine}</div>`;
					}

					// Slot 2
					if (selectedDose === '2') {
						totalSlots += parseInt(s.Available_Dose2);
						dailyAvailable = `<span class='available'>${s.Available_Dose2}</span>`;
						dailyAvailable += `<div class='vaccine'>${s.Vaccine}</div>`;
					}

					if (dailyAvailable !== '') {
						resultTable.rows[rowNumber].cells[i].innerHTML = dailyAvailable;
						resultTable.rows[rowNumber].cells[i].className = 'slot';
					}
				}
			}
		});

		rowNumber += 1;
	});

	if (totalSlots === 0) {
		clearResult();
		resultDiv.innerHTML = 'No slots found!';
	}

	totalSlotsSpan.innerHTML = totalSlots;
}

function setCurrentDate() {
	const date = new Date();
	dateTextBox.value = `${date.getFullYear()}-${padLeft(
		date.getMonth() + 1,
		2,
		'0'
	)}-${padLeft(date.getDate(), 2, '0')}`;
}

function padLeft(stringValue, length, paddingCharacter) {
	stringValue = stringValue.toString();

	while (stringValue.length < length) stringValue = paddingCharacter + stringValue;

	return stringValue;
}

function getInputDate() {
	let inputDate = Date.parse(dateTextBox.value);

	if (isNaN(inputDate)) {
		alert('Please enter a valid date');
		return null;
	} else {
		inputDate = new Date(dateTextBox.value);
	}

	return getFormattedDate(inputDate);
}

function getFormattedDate(date) {
	return `${padLeft(date.getDate(), 2, '0')}-${padLeft(
		date.getMonth() + 1,
		2,
		'0'
	)}-${date.getFullYear()}`;
}

function getHeaderDate(date) {
	const options = { year: 'numeric', month: 'short', day: 'numeric' };
	return date.toLocaleDateString('en-GB', options);
}

function clearResult() {
	totalSlotsSpan.innerHTML = 0;
	resultDiv.innerHTML = '';
	resultTable.innerHTML = '';
	totalSlots = 0;
}

function searchByDistrict() {
	clearResult();
	const districtId = parseInt(districtDropdown.value);
	const date = getInputDate();

	if (isNaN(districtId) || districtId === 0) {
		alert('Please select district');
		return;
	}

	if (!date) return;

	districtNameSpan.innerHTML = `${
		districtDropdown.options[districtDropdown.selectedIndex].text
	}`;
	getSlotsByDistrict(districtId, date);
}

function searchByPincode() {
	clearResult();
	const pincode = parseInt(PincodeTextBox.value);
	const date = getInputDate();

	if (isNaN(pincode) || pincode === 0) {
		alert('Please enter pincode');
		return;
	}

	if (!date) return;

	getSlotsByPinCode(pincode, date);
}

loadStateDropdown();
setCurrentDate();
