document.addEventListener("DOMContentLoaded", function () {
    const au_csvUrl = "member_directory/RAMSC26 Member Directory.csv";
    const au_imageFolder = "member_directory/EC26/";
    const au_placeholderImg = "member_directory/person_holder.png";

    // Clicking a UI tab looks for the matching code in the CSV 'ฝ่าย' column
    const au_departmentMap = {
        "Exec": "EC", "EC": "EC",
        "IA": "IA", "สาราณียกร": "IA",
        "EA": "EA", "วิชาการ": "EA",
        "CC": "CC", "บันเทิง": "CC",
        "AA": "AA", "กีฬา": "AA",
        "OD": "OD", "ศิลปะ": "OD",
        "WB": "WB", "สวัสดิการ": "WB"
    };

    const statusEl = document.getElementById("au_loading_status");
    const gridEl = document.getElementById("au_members_grid");

    let au_allMembersData = [];
    let au_currentFilter = "Exec";

    // ---------- CSV ----------
    // Full-text parser: handles quoted cells, "" escapes, commas and newlines inside quotes.
    // (Apostrophes are NOT treated as quotes, so names like O'Brien are safe.)
    function au_parseRows(text) {
        text = text.replace(/^﻿/, "");
        const rows = [];
        let row = [], cell = "", inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { cell += '"'; i++; }
                    else inQuotes = false;
                } else cell += ch;
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                row.push(cell); cell = "";
            } else if (ch === "\n" || ch === "\r") {
                if (ch === "\r" && text[i + 1] === "\n") i++;
                row.push(cell); cell = "";
                rows.push(row); row = [];
            } else cell += ch;
        }
        if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
        return rows.filter(r => r.some(c => c.trim() !== ""));
    }

    function au_clean(s) {
        return (s || "").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim();
    }

    function au_parseCSV(text) {
        const rows = au_parseRows(text);
        if (!rows.length) return [];

        const headers = rows[0].map(au_clean);
        const find = label => headers.indexOf(label);
        const nameIdx = find("Name - Surname (English)");
        const deptIdx = find("ฝ่าย");
        const picIdx = find("To picture");
        const roleIdx = find("ตำแหน่ง");

        if (nameIdx === -1 || deptIdx === -1 || picIdx === -1 || roleIdx === -1) {
            console.error("CSV column mismatch. Found headers:", headers);
            return [];
        }

        const results = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const name = au_clean(r[nameIdx]);
            const dept = au_clean(r[deptIdx]);
            if (!name || !dept) continue;
            results.push({
                name: name,
                thaiDept: dept,
                picFilename: au_clean(r[picIdx]),
                roleText: au_clean(r[roleIdx])
            });
        }
        return results;
    }

    // ---------- Images ----------
    // Build a list of filenames to try, in order, so case / Unicode / extension
    // differences between the CSV and the real files don't break the photo.
    function au_imageCandidates(filename) {
        if (!filename) return [];
        let f = filename.split(/[\\/]/).pop().trim();
        const list = [];
        const add = v => { if (v && list.indexOf(v) === -1) list.push(v); };

        const dot = f.lastIndexOf(".");
        const base = dot > 0 ? f.slice(0, dot) : f;
        const ext = dot > 0 ? f.slice(dot + 1) : "";

        const bases = [f.slice(0, dot > 0 ? dot : f.length)];
        bases.push(base.normalize("NFC"), base.normalize("NFD"));

        const exts = ext
            ? [ext, ext.toLowerCase(), ext.toUpperCase()]
            : [];
        ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG"].forEach(e => exts.push(e));

        bases.forEach(b => exts.forEach(e => add(b + "." + e)));
        if (!ext) add(f);
        return list;
    }

    function au_buildImage(member) {
        const img = document.createElement("img");
        img.alt = member.name;
        img.loading = "lazy";

        const queue = au_imageCandidates(member.picFilename).map(
            n => au_imageFolder + encodeURIComponent(n)
        );
        queue.push(au_placeholderImg);

        let idx = 0;
        img.onerror = function () {
            idx++;
            if (idx < queue.length) {
                img.src = queue[idx];
            } else {
                img.onerror = null;
            }
            if (idx === queue.length - 1 && member.picFilename) {
                console.warn("Photo not found for " + member.name + " (CSV: '" + member.picFilename + "')");
            }
        };
        img.src = queue[0];
        return img;
    }

    // ---------- Render ----------
    function au_deptCode(value) {
        if (value in au_departmentMap) return au_departmentMap[value];
        const key = Object.keys(au_departmentMap).find(
            k => k.toLowerCase() === value.toLowerCase()
        );
        return key ? au_departmentMap[key] : value;
    }

    function au_renderGrid() {
        gridEl.innerHTML = "";
        const target = au_departmentMap[au_currentFilter];
        const filtered = au_allMembersData.filter(m => au_deptCode(m.thaiDept) === target);

        if (!filtered.length) {
            const p = document.createElement("p");
            p.style.cssText = "grid-column:1/-1;color:#777;margin-top:20px;";
            p.textContent = "No members found for this category.";
            gridEl.appendChild(p);
            return;
        }

        filtered.forEach(member => {
            const card = document.createElement("div");
            card.className = "au_card";

            const frame = document.createElement("div");
            frame.className = "au_image_frame";
            frame.appendChild(au_buildImage(member));

            const h3 = document.createElement("h3");
            h3.className = "au_member_name";
            h3.textContent = member.name;

            const p = document.createElement("p");
            p.className = "au_member_role";
            p.textContent = member.roleText;

            card.append(frame, h3, p);
            gridEl.appendChild(card);
        });
    }

    // ---------- Init ----------
    fetch(encodeURI(au_csvUrl))
        .then(res => {
            if (!res.ok) throw new Error("CSV file could not be fetched (" + res.status + ").");
            return res.text();
        })
        .then(text => {
            au_allMembersData = au_parseCSV(text);
            if (statusEl) statusEl.style.display = "none";
            au_renderGrid();
        })
        .catch(err => {
            console.error("Error handling directory data:", err);
            if (statusEl) statusEl.textContent = "Failed to load directory data.";
        });

    const filterButtons = document.querySelectorAll(".au_filter_btn");
    filterButtons.forEach(button => {
        button.addEventListener("click", function () {
            filterButtons.forEach(b => b.classList.remove("au_active"));
            this.classList.add("au_active");
            au_currentFilter = this.getAttribute("data-dept");
            au_renderGrid();
        });
    });
});