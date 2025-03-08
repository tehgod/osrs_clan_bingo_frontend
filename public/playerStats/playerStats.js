async function populateDropdown() {
    const response = await fetch('/api/getActivities');
    const data = await response.json();
    for (const activity of data) {
        const option = document.createElement('option');
        option.value = activity["Activity"];
        option.textContent = activity["Activity"];
        document.getElementById('skill-select').appendChild(option);
    }
    document.getElementById('skill-select').onchange = populateHighscoreData;
    document.getElementById('skill-select').selectedIndex =0;
}

async function updateUserStats(username) {
    const response = await fetch(`/api/updatePlayerStats?username=${username}`);
    const data = await response.json();
    return data;
}

async function setCurrentValues() {
    const selectedActivity = document.getElementById('skill-select').value;
    const response = await fetch(`/api/setCurrentValues?activity=${selectedActivity}`);
    const data = await response.json();
    return data;
}


async function bindOnClicks(approverStatus) {
    document.getElementById('update-button').onclick = async () => {
        document.getElementById('update-button').classList.add('disabled');
        var teamUsernames = await getTeamUsernames();
        if (teamUsernames.length == 0) {
            alert("Please login to continue");
            window.location.href = '/';
            return;
        }
        for (var i = 0; i < teamUsernames.length; i++) {
            await updateUserStats(teamUsernames[i]);
        }
        await populateDropdown();
        await populateHighscoreData();
        document.getElementById('update-button').classList.remove('disabled');
        document.getElementById('set-button').classList.add('disabled');
        if (approverStatus==1){
            document.getElementById('set-button').classList.remove('disabled');
        }
        
    };

    document.getElementById('set-button').onclick = async () => {
        var r = await setCurrentValues();
        if (r["message"]== "Error") {
            alert("Please login to continue");
            window.location.href = '/';
            return;
        }
        await populateHighscoreData();
        document.getElementById('set-button').classList.add('disabled');
    }
}

async function getTeamUsernames() {
    const response = await fetch('/api/getTeamMembers');
    const data = await response.json();
    return data;
}

async function getTeamStats(activity) {
    const response = await fetch('/api/getTeamActivityStats?activity=' + activity);
    const data = await response.json();

    var userStats = {};
    for (var record of data) {
        if (!userStats[record["Username"]]) {
            userStats[record["Username"]] = {
                "Current": null,
                "Pinned": null
            };
        }
        if (record["RecordType"] == "Current") {
            userStats[record["Username"]]["Current"] = record["Score"];
        }
        if (record["RecordType"] == "Pinned") {
            userStats[record["Username"]]["Pinned"] = record["Score"];
        }
    }
    return userStats;
}

async function populateHighscoreData() {
    const selectedActivity = document.getElementById('skill-select').value;
    const tableBody = document.getElementById('player-stats-table');
    tableBody.innerHTML = ''; // Clear existing rows

    var teamStats = await getTeamStats(selectedActivity);

    xpHeader = "Starting Score/XP (Not Set)";
    for (stat in teamStats) {
        if (teamStats[stat]["Pinned"] != null) {
            xpHeader = "Starting Score/XP";
            break;
        }
    }

    // Create the table header with Bootstrap styling
    const tableHeader = document.getElementById('table-header');
    tableHeader.innerHTML = `
        <th>Username</th>
        <th>Current Score/XP</th>
        <th>${xpHeader}</th>
        <th>Difference</th>
    `;
    var totalDifference = 0;

    for (var username in teamStats) {
        let currentXp = teamStats[username]["Current"];
        let pinnedXp = teamStats[username]["Pinned"];

        if (currentXp == null) {
            currentXp = 0;
        }
        if (pinnedXp == null) {
            pinnedXp = currentXp;
        }

        // Create a table row
        const row = document.createElement('tr');
        row.classList.add('table-row'); // Optionally, you can add a custom class for rows
        
        // Fill in the row's cells with data
        row.innerHTML = `
            <td>${username}</td>
            <td>${currentXp}</td>
            <td>${pinnedXp}</td>
            <td>${currentXp - pinnedXp}</td>
        `;
        
        totalDifference += (currentXp - pinnedXp);
        // Append the row to the table body
        tableBody.appendChild(row);
    }
    const row = document.createElement('tr');
    row.classList.add('table-row');
    row.innerHTML = `
        <td class="right" colspan="3">Total:</td><td class="right">${totalDifference}</td>
    `;
    tableBody.appendChild(row);
}

async function loadUserInfo() {
    var userInfo = await fetch(`/api/userInfo`)
        .then(response => response.json());

    return userInfo[0]
}

function applyUserChanges(approverStatus) {
    if (approverStatus!=1){
        document.getElementById("set-button").remove();
    }   else {
        document.getElementById("set-button").classList.remove('disabled');
    }
}

(async () => {
    userInfo = await loadUserInfo()
    applyUserChanges(userInfo.Approver);
    await populateDropdown();
    populateHighscoreData();
    bindOnClicks(userInfo.Approver);
})(); 
