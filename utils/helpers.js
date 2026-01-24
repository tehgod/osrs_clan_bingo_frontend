function getAdjacentCells(cell) {
    var regex = /^([a-zA-Z]+)(\d+)$/;
    var match = cell.match(regex);

    if (!match) {
        throw new Error('Invalid cell format');
    }

    const column = match[1].toUpperCase(); // Convert to uppercase for calculations
    const row = parseInt(match[2], 10); // Row number

    // Create an array of adjacent cells in lowercase
    const adjacentCells = [
        `${column}${row - 1}`.toLowerCase(), // Cell above
        `${column}${row + 1}`.toLowerCase(), // Cell below
        `${String.fromCharCode(column.charCodeAt(0) - 1)}${row}`.toLowerCase(), // Cell to the left
        `${String.fromCharCode(column.charCodeAt(0) + 1)}${row}`.toLowerCase()  // Cell to the right
    ];

    return adjacentCells;
}

const fixcdn = (urlString) => {
    const url = new URL(urlString);  // Create URL object from the string

    const exStr = url.searchParams.get('ex');
    const exTime = parseInt(exStr, 16) * 1000;

    // If expiration time is invalid or expired, return the CDN URL
    if (isNaN(exTime) || exTime <= Date.now()) {
        return 'https://fixcdn.hyonsu.com' + url.pathname;
    }

    // If no issues, return the original URL
    return url.href;
};

async function sendDiscordUpdate(webhookUrl, payload) {

    const maxFieldsPerMessage = 15;

    const allFields = payload.embeds[0].fields;

    const chunks = [];
    for (let i = 0; i < allFields.length; i += maxFieldsPerMessage) {
        chunks.push(allFields.slice(i, i + maxFieldsPerMessage));
    }

    for (const chunk of chunks) {

        const chunkPayload = {
            ...payload,
            embeds: [
                {
                    ...payload.embeds[0],
                    fields: chunk
                }
            ]
        };

        try {
            const response = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    'Content-type': 'application/json'
                },
                body: JSON.stringify(chunkPayload)
            });

            if (!response.ok) {
                console.error('Error sending Discord update:', response.statusText);
            }

        } catch (error) {
            console.error('Error sending Discord update:', error);
        }
    }
}

module.exports = { getAdjacentCells, fixcdn, sendDiscordUpdate };