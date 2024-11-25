async function getUsernameStats(username) {
    const response = await fetch(`/api/getPlayerStats?username=${username}`);
    const data = await response.json();
    return data;
}

async function getTeamUsernames() {
    const response = await fetch('/api/getTeamMembers');
    const data = await response.json();
    return data;
}

async function populateDropdown() {
    const player = await getUsernameStats('kacy');
    var activityNames = [];
    for (const skillId in player.skills) {
        const skillName = player.skills[skillId].name;
        activityNames.push(skillName);
    }
    for (const activityId in player.activities) {
        const activityName = player.activities[activityId].name;
        activityNames.push(activityName);
    }
    for (const activity of activityNames) {
        const option = document.createElement('option');
        option.value = activity;
        option.textContent = activity;
        document.getElementById('skill-select').appendChild(option);
    }
    document.getElementById('skill-select').onchange = updateTable;
    document.getElementById('skill-select').selectedIndex =0;
}

async function getTeamStats() {
    const usernames = await getTeamUsernames();
    const teamStats = [];
    for (const username of usernames) {
        const player = await getUsernameStats(username);
        teamStats.push(player);
    }
    return teamStats;
}

async function populateHighscoreData() {
    const selectedActivity = document.getElementById('skill-select').value;
    const tableBody = document.getElementById('player-stats-table');
    tableBody.innerHTML = ''; // Clear existing rows
    // Loop through all skills and populate the table
    var currentStat = null;
    var teamUsernames = await getTeamUsernames();
    console.log(teamUsernames);
    for (var i = 0; i < teamUsernames.length; i++) {
        username = teamUsernames[i];
        console.log(username);
        const player = await getUsernameStats(username);
        currentStat = null;
        for (const skillId in player.skills) {
            if (player.skills[skillId].name === selectedActivity) {
                currentStat = player.skills[skillId].xp;
                break;
            }
        }
        if (currentStat === null) {
            for (const activity in player.activities) {
                if (player.activities[activity].name === selectedActivity) {
                    currentStat = player.activities[activity].score;
                    break;
                }
            }
        }
        if (currentStat === null) {
            currentStat = 0;
        }
        const row = document.createElement('tr');
        row.innerHTML = `
            <td id="username">${username}</td>
            <td id="start">${currentStat}</td>
            <td id="current">${currentStat}</td>
            <td id="difference"></td>
        `;
        tableBody.appendChild(row);
            
    };
}

async function updateTable() {
    
    await populateHighscoreData();
}


(async () => {

    await populateDropdown();
    
})(); 


// {/* <script>
//     // Player data for simulation
//     const players = {
//         john: {
//             name: "John Doe",
//             startingStats: {
//                 attack: 50,
//                 strength: 60,
//                 defence: 55,
//                 range: 45,
//                 magic: 40,
//                 slayer: 30,
//                 crafting: 25,
//                 fishing: 20,
//                 cooking: 35
//             },
//             currentStats: {
//                 attack: 99,
//                 strength: 99,
//                 defence: 99,
//                 range: 95,
//                 magic: 92,
//                 slayer: 85,
//                 crafting: 99,
//                 fishing: 80,
//                 cooking: 90
//             }
//         },
//         jane: {
//             name: "Jane Smith",
//             startingStats: {
//                 attack: 40,
//                 strength: 45,
//                 defence: 42,
//                 range: 40,
//                 magic: 38,
//                 slayer: 25,
//                 crafting: 20,
//                 fishing: 15,
//                 cooking: 25
//             },
//             currentStats: {
//                 attack: 85,
//                 strength: 88,
//                 defence: 90,
//                 range: 92,
//                 magic: 89,
//                 slayer: 95,
//                 crafting: 85,
//                 fishing: 75,
//                 cooking: 88
//             }
//         },
//         michael: {
//             name: "Michael Brown",
//             startingStats: {
//                 attack: 45,
//                 strength: 50,
//                 defence: 48,
//                 range: 50,
//                 magic: 40,
//                 slayer: 40,
//                 crafting: 30,
//                 fishing: 30,
//                 cooking: 30
//             },
//             currentStats: {
//                 attack: 90,
//                 strength: 91,
//                 defence: 89,
//                 range: 85,
//                 magic: 80,
//                 slayer: 80,
//                 crafting: 92,
//                 fishing: 85,
//                 cooking: 75
//             }
//         }
//     };

//     // Function to update the stats when a player is selected
//     function updatePlayerStats() {
//         const playerId = document.getElementById('player-select').value;
//         const player = players[playerId];

//         // Get the table body to clear previous rows
//         const tableBody = document.getElementById('player-stats-table').getElementsByTagName('tbody')[0];
//         tableBody.innerHTML = ''; // Clear existing rows

//         // Loop through all skills and populate the table
//         for (const skill in player.startingStats) {
//             const startingStat = player.startingStats[skill];
//             const currentStat = player.currentStats[skill];
//             const difference = currentStat - startingStat;

//             // Create a row for each skill
//             const row = document.createElement('tr');
//             row.innerHTML = `
//                 <td>${capitalizeFirstLetter(skill)}</td>
//                 <td>${startingStat}</td>
//                 <td>${currentStat}</td>
//                 <td>${difference}</td>
//                 <td><button onclick="dummyFunction('${skill}')">Action</button></td>
//             `;
//             tableBody.appendChild(row);
//         }
//     }

//     // Dummy function for the button
//     function dummyFunction(skill) {
//         alert(`Dummy function triggered for ${skill}!`);
//     }

//     // Initialize the stats with the default player (first option in the dropdown)
//     window.onload = updatePlayerStats;

//     // Helper function to capitalize skill names
//     function capitalizeFirstLetter(string) {
//         return string.charAt(0).toUpperCase() + string.slice(1);
//     }
// </script> */}
