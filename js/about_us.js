document.addEventListener("DOMContentLoaded", function () {
    const au_csvUrl = "member_directory/RAMSC26 Member Directory.csv";
    const au_imageFolder = "member_directory/EC26/";
    const au_placeholderImg = "member_directory/person_holder.png";

    // Updated mapping: Clicking "Exec" on the UI will look for "EC" in the CSV 'ฝ่าย' column
    const au_departmentMap = {
        "Exec": "EC", 
        "IA": "IA", "สาราณียกร": "IA",
        "EA": "EA", "วิชาการ": "EA",
        "CC": "CC", "บันเทิง": "CC",
        "AA": "AA", "กีฬา": "AA",
        "OD": "OD", "ศิลปะ": "OD",
        "WB": "WB", "สวัสดิการ": "WB"
    };

    let au_allMembersData = [];
    let au_currentFilter = "Exec"; // Default active UI tab

    fetch(au_csvUrl)
        .then(response => {
            if (!response.ok) throw new Error("CSV file could not be fetched.");
            return response.text();
        })
        .then(csvText => {
            au_allMembersData = au_parseCSV(csvText);
            document.getElementById("au_loading_status").style.display = "none";
            au_renderGrid();
        })
        .catch(error => {
            console.error("Error handling directory data:", error);
            document.getElementById("au_loading_status").innerText = "Failed to load directory data.";
        });

    // CSV Parser that extracts the required columns
    function au_parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) return [];

        const headers = au_splitCSVRow(lines[0]);
        const nameIdx = headers.indexOf("Name - Surname (English)");
        const deptIdx = headers.indexOf("ฝ่าย");
        const picIdx = headers.indexOf("To picture");
        const roleIdx = headers.indexOf("ตำแหน่ง");

        if (nameIdx === -1 || deptIdx === -1 || picIdx === -1 || roleIdx === -1) {
            console.error("CSV Column mismatch. Verify headers: 'ฝ่าย', 'Name - Surname (English)', 'To picture', and 'ตำแหน่ง' must exist.");
            return [];
        }

        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cleanRow = au_splitCSVRow(line);

            if (cleanRow[nameIdx] && cleanRow[deptIdx]) {
                results.push({
                    name: cleanRow[nameIdx],
                    thaiDept: cleanRow[deptIdx].trim(), // Clean spaces
                    picFilename: cleanRow[picIdx] || "",
                    roleText: cleanRow[roleIdx] || ""
                });
            }
        }
        return results;
    }

    // Helper to split CSV rows while respecting quotation blocks
    function au_splitCSVRow(line) {
        const result = [];
        let currentCell = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' || char === "'") {
                inQuotes = !inQuotes; 
            } else if (char === ',' && !inQuotes) {
                result.push(currentCell.trim());
                currentCell = "";
            } else {
                currentCell += char;
            }
        }
        result.push(currentCell.trim());
        return result;
    }

    // Render grid using the precise mapping targets
    function au_renderGrid() {
        const gridContainer = document.getElementById("au_members_grid");
        gridContainer.innerHTML = "";

        // Get the target string we are searching for in the CSV (e.g., "EC" for "Exec")
        const targetSearchValue = au_departmentMap[au_currentFilter];

        const filtered = au_allMembersData.filter(member => {
            // Check if the CSV 'ฝ่าย' matches the target value directly
            return member.thaiDept === targetSearchValue || 
                   (au_departmentMap[member.thaiDept] === targetSearchValue);
        });

        if (filtered.length === 0) {
            gridContainer.innerHTML = `<p style="grid-column: 1/-1; color: #777; margin-top: 20px;">No members found for this category.</p>`;
            return;
        }

        filtered.forEach(member => {
            const card = document.createElement("div");
            card.className = "au_card";

            const finalImgSrc = member.picFilename 
                ? `${au_imageFolder}${encodeURIComponent(member.picFilename.trim())}` 
                : au_placeholderImg;

            card.innerHTML = `
                <div class="au_image_frame">
                    <img src="${finalImgSrc}" 
                         alt="${member.name}" 
                         onerror="this.onerror=null; this.src='${au_placeholderImg}';">
                </div>
                <h3 class="au_member_name">${member.name}</h3>
                <p class="au_member_role">${member.roleText}</p> 
            `;
            gridContainer.appendChild(card);
        });
    }

    // Tab button event setup
    const filterButtons = document.querySelectorAll(".au_filter_btn");
    filterButtons.forEach(button => {
        button.addEventListener("click", function () {
            filterButtons.forEach(btn => btn.classList.remove("au_active"));
            this.classList.add("au_active");
            au_currentFilter = this.getAttribute("data-dept");
            au_renderGrid();
        });
    });
});