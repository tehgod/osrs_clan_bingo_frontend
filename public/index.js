

function a1ToNumber(a1) {
    // Extract column letters and row number
    const match = a1.match(/([a-zA-Z]+)(\d+)/); // Allow both lowercase and uppercase
    if (!match) {
        throw new Error('Invalid A1 format');
    }

    const columnLetters = match[1].toUpperCase(); // Convert to uppercase
    const rowNumber = parseInt(match[2], 10); // Extract the row number

    // Convert column letters to a number
    let columnNumber = 0;
    for (let i = 0; i < columnLetters.length; i++) {
        columnNumber = columnNumber * 26 + (columnLetters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }

    return {
        column: columnNumber,
        row: rowNumber,
        index: (columnNumber - 1) + (rowNumber - 1) * 26 // Optional: single index representation
    };
}

function numberToA1(column, row, toUpperCase = true) {
    let columnLetters = '';

    // Convert column number to letters
    while (column > 0) {
        const remainder = (column - 1) % 26;
        columnLetters = String.fromCharCode(remainder + 'A'.charCodeAt(0)) + columnLetters;
        column = Math.floor((column - 1) / 26);
    }

    // Convert to lowercase if specified
    if (!toUpperCase) {
        columnLetters = columnLetters.toLowerCase();
    }

    // Combine letters and row number
    return columnLetters + row;
}

function loadScoreboard() {
    const tableBody = document.getElementById('scoreboard').querySelector('tbody');

    // Helper function to create a row with cell values and attributes
    function createRow(cellValues, isHeader = false) {
        const row = document.createElement('tr');
        cellValues.forEach(cellData => {
            const cell = document.createElement(isHeader ? 'th' : 'td');

            // Set content and attributes based on cellData type
            if (typeof cellData === 'string') {
                cell.innerText = cellData;
            } else {
                if (cellData.id) cell.setAttribute('id', cellData.id);
                if (cellData.text) cell.innerText = cellData.text;
                if (cellData.class) cell.classList.add(cellData.class);
            }
            row.appendChild(cell);
        });
        return row;
    }

    // Header row
    const headerRow = createRow([
        "Task", 
        { text: "Beginner", class: "beginner" }, 
        { text: "Easy", class: "easy" }, 
        { text: "Medium", class: "medium" }, 
        { text: "Hard", class: "hard" }, 
        { text: "Elite", class: "elite" }, 
        { text: "Master", class: "master" }, 
        { text: "Completed", class: "completed" }
    ], true);

    // Default points row with difficulty attributes
    const defaultPointsRow = createRow([
        { text: "Points" },
        { text: "1", class: "beginner" },
        { text: "2", class: "easy" },
        { text: "3", class: "medium" },
        { text: "4", class: "hard" },
        { text: "5", class: "elite" },
        { text: "6", class: "master" },
        { id: "teamPoints", class: "completed" }
    ]);

    // Total possible row with IDs and difficulty/completed attributes
    const totalPossibleRow = createRow([
        { text: "Total Possible" },
        { id: "possibleBeginnerPoints", class: "beginner" },
        { id: "possibleEasyPoints", class: "easy" },
        { id: "possibleMediumPoints", class: "medium" },
        { id: "possibleHardPoints", class: "hard" },
        { id: "possibleElitePoints", class: "elite" },
        { id: "possibleMasterPoints", class: "master" },
        { id: "totalPossiblePoints", class: "completed" }
    ]);

    // Append rows to table body
    tableBody.appendChild(headerRow);
    tableBody.appendChild(defaultPointsRow);
    tableBody.appendChild(totalPossibleRow);
}

async function loadBingoBoard() {
    const teamId = 1;

    document.title=`Team ${teamId}`;

    document.getElementById("teamHeader").textContent=`Team ${teamId}`;

    const templateNumber = await fetch(`/api/getTemplateNumber?teamId=${teamId}`)
        .then(response => response.json())
        .then(data => data[0].Template);

    const templateData = await fetch(`/api/getTemplate?templateId=${templateNumber}`)
        .then(response => response.json());
    
    first_tile = a1ToNumber(templateData[0].Cell)
    var firstColumn = first_tile.column;
    var lastColumn = first_tile.column;
    var firstRow = first_tile.row;
    var lastRow = first_tile.row;

    templateData.forEach((tile) => {
        current_tile = a1ToNumber(tile.Cell)
        if (current_tile.column<firstColumn) firstColumn = current_tile.column
        if (current_tile.column>lastColumn) lastColumn = current_tile.column
        if (current_tile.row<firstRow) firstRow = current_tile.row
        if (current_tile.row>lastRow) lastRow = current_tile.row
    });

    const gridTableBody = document.getElementById('bingo-board').querySelector('tbody');

    for (let i = firstRow; i <= lastRow; i++) {
        const row = document.createElement('tr');
        for (let j = firstColumn; j <= lastColumn; j++) {
            const cell = document.createElement('td');
            cell.id = numberToA1(j, i, false); // Display row and column numbers
            row.appendChild(cell);
        }
        gridTableBody.appendChild(row);
    };

    templateData.forEach((tile) => {
        document.getElementById(tile.Cell).classList.add(tile.Difficulty)
    });

    const tileUrls = await fetch(`/api/getUrls?teamId=${teamId}`)
        .then(response => response.json())
    
    console.log(tileUrls)
    
    const urlsMap = {};

    tileUrls.forEach(item => {
        if (!urlsMap[item.Cell]) {
            urlsMap[item.Cell] = [];
        }
        urlsMap[item.Cell].push(item.Url);
    });

    for (const cell in urlsMap) {
        const cellElement = document.getElementById(cell);
        if (cellElement) {
            cellElement.setAttribute('data-urls', JSON.stringify(urlsMap[cell]));
        }
    }

    const completedTiles = await fetch(`/api/getCompleted?teamId=${teamId}`)
        .then(response => response.json())

    completedTiles.forEach((tile) => {
        document.getElementById(tile.Cell).innerText=tile.Task
        if (tile.Status == 1) {
            document.getElementById(tile.Cell).classList.add("completed")
        }
        
    })
}

function calculateScore() {
    completedElements = document.querySelectorAll('[completed="true"]');
    console.log(completedElements)
}

function addLink() {
    if (linkURL) {
        // Create a new list item
        const listItem = document.createElement('li');

        // Create the hyperlink
        const link = document.createElement('a');
        link.href = linkURL;
        link.textContent = `Link ${linkCount++}`;
        link.target = "_blank"; // Opens link in a new tab

        // Create and add remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.classList.add('remove-btn');
        removeButton.onclick = () => listItem.remove();

        // Append link and button to list item, and list item to list
        listItem.appendChild(link);
        listItem.appendChild(removeButton);
        document.getElementById('itemList').appendChild(listItem);

        // Clear input field
        linkInput.value = '';
    } else {
        alert("Please enter a valid URL.");
    }
}

function bindOnClicks() {
    // Select all <td> elements with the class "clickable"
    const bingoBoardTiles = document.querySelectorAll("#bingo-board td");

    // Loop through each <td> and add an onclick event listener
    bingoBoardTiles.forEach(tile => {
        tile.addEventListener("click", function() {
            document.getElementById("selectedTileUrlsList").innerHTML=""
            document.getElementById('selectedTile').value = tile.id;
            document.getElementById('selectedTileTask').textContent =`Task: ${tile.textContent}`;
            if (tile.classList.contains("completed")){
                document.getElementById('selectedTileCompleted').checked=true
            } else {
                document.getElementById('selectedTileCompleted').checked=false
            }
            const urls = JSON.parse(tile.getAttribute('data-urls') || '[]');
            var i = 1
            urls.forEach((url) => {
                listItem = document.createElement("li")
                link = document.createElement("a")
                link.textContent = `Picture ${i}`;
                link.href = url;
                listItem.appendChild(link)
                document.getElementById("selectedTileUrlsList").appendChild(listItem)
                i++;
            });
            
        });
    });
}

(async () => {
    // Create Grid
    loadScoreboard();
    await loadBingoBoard();
    calculateScore();
    bindOnClicks();
})(); // Immediately invoke the async function