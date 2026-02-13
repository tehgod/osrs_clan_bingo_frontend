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
    await fetch(`/api/updatePlayerStats?username=${username}`);
}

async function setCurrentValues() {
    const selectedActivity = document.getElementById('skill-select').value;
    const response = await fetch(`/api/setCurrentValues?activity=${selectedActivity}`);
    const data = await response.json();
    return data;
}


async function bindOnClicks(approverStatus) {
    document.getElementById('update-button').onclick = async () => {
        const button = document.getElementById('update-button');
        button.classList.add('disabled');
        
        // Add loading spinner
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Updating...';
        
        var teamUsernames = await getTeamUsernames();
        if (teamUsernames.length == 0) {
            alert("Please login to continue");
            window.location.href = '/';
            return;
        }
        for (var i = 0; i < teamUsernames.length; i++) {
            await updateUserStats(teamUsernames[i]);
        }
        const selectedActivity = document.getElementById('skill-select').value;
        await populateDropdown();
        await populateHighscoreData();
        document.getElementById('skill-select').value = selectedActivity;
        
        // Restore button
        button.innerHTML = originalText;
        button.classList.remove('disabled');
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
    return data;
}

async function populateHighscoreData() {
    const selectedActivity = document.getElementById('skill-select').value;
    const tableBody = document.getElementById('player-stats-table');
    tableBody.innerHTML = ''; // Clear existing rows

    var teamStats = await getTeamStats(selectedActivity);

    const pinnedStatus = await fetch (`/api/getPinnedStatus?activity=${selectedActivity}`)

        .then(response => response.json());

    let xpHeader = "Starting Score/XP";
    let xpHeaderStyle = "";

    if (!pinnedStatus) {
        xpHeader += " (NOT SET)";
        xpHeaderStyle = ' style="color: red;"';
    }


    // Create the table header with Bootstrap styling
    const tableHeader = document.getElementById('table-header');
    tableHeader.innerHTML = `
        <th>Username</th>
        <th>Current Score/XP</th>
        <th${xpHeaderStyle}>${xpHeader}</th>
        <th>Difference</th>
    `;
    var totalDifference = 0;

    for (var user in teamStats) {
        let currentXp = teamStats[user]["Current"];
        let pinnedXp = teamStats[user]["Pinned"];
        let username = teamStats[user]["Username"];

        // Create a table row
        const row = document.createElement('tr');
        row.classList.add('table-row'); // Optionally, you can add a custom class for rows
        
        // Fill in the row's cells with data
        row.innerHTML = `
            <td>${username}</td>
            <td>${currentXp.toLocaleString()}</td>
            <td>${pinnedXp.toLocaleString()}</td>
            <td>${(currentXp - pinnedXp).toLocaleString()}</td>
        `;
        
        totalDifference += (currentXp - pinnedXp);
        // Append the row to the table body
        tableBody.appendChild(row);
    }
    const row = document.createElement('tr');
    row.classList.add('table-row');
    row.innerHTML = `
        <td class="right" colspan="3">Total:</td><td class="right">${totalDifference.toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
}

async function loadUserInfo() {
    var userInfo = await fetch(`/api/userInfo`)
        .then(response => response.json());

    return userInfo[0]
}

function applyUserChanges(userInfo) {
    if (userInfo.Approver!=1){
        document.getElementById("set-button").remove();
    }   else {
        document.getElementById("set-button").classList.remove('disabled');
    }

    document.title=`Team ${userInfo.Team}`;

    document.getElementById("teamHeader").textContent=`Team ${userInfo.Team}`;
}


(async () => {
    userInfo = await loadUserInfo()
    applyUserChanges(userInfo);
    await populateDropdown();
    populateHighscoreData();
    bindOnClicks(userInfo.Approver);
})(); 
