document.addEventListener("DOMContentLoaded", async () => {
    const contentContainer = document.getElementById("full-article-content");
    
    // Get the ID from the URL (e.g., read.html?id=2)
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const dataFolder = "_data";

    if (!id) {
        contentContainer.innerHTML = "<h2>Article not found. Please return to the articles page.</h2>";
        return;
    }

    try {
        const mdResponse = await fetch(`${dataFolder}/${id}.md`);
        if (!mdResponse.ok) throw new Error("File not found");
        
        const mdText = await mdResponse.text();
        
        // --- YAML Frontmatter Parser ---
        let title = "Untitled";
        let tags = [];
        let thumbnail = `${id}.jpg`;
        let author = "";
        let date = ""; // Add date variable
        let markdownBody = mdText;

        const fmRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
        const match = mdText.match(fmRegex);

        if (match) {
            const fmText = match[1];
            markdownBody = match[2];

            const titleMatch = fmText.match(/title:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
            if (titleMatch) title = titleMatch[1];

            const tagsMatch = fmText.match(/tags:\s*\[(.*?)\]/);
            if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.replace(/["']/g, '').trim());

            const thumbMatch = fmText.match(/thumbnail:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
            if (thumbMatch) thumbnail = thumbMatch[1];
            
            const authorMatch = fmText.match(/author:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
            if (authorMatch) author = authorMatch[1];

            // Extract and Format Date (Date and Time)
            const dateMatch = fmText.match(/date:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
            if (dateMatch) {
                let rawDate = dateMatch[1].trim();
                
                // 1. Extract the date (looks for XX/XX/XXXX)
                let dateString = "";
                const dayMatch = rawDate.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
                if (dayMatch) {
                    dateString = dayMatch[0];
                } else {
                    dateString = rawDate.split('T')[0].trim(); // Fallback
                }

                // 2. Extract the time (looks for HH:MM)
                const timeMatch = rawDate.match(/\d{2}:\d{2}/g);
                
                if (timeMatch && timeMatch.length >= 2) {
                    // Joins them together: "10/05/2026, 09:00 - 17:00"
                    date = `${dateString}, ${timeMatch[0]} - ${timeMatch[1]}`; 
                } else {
                    date = rawDate; // Fallback just in case
                }
            }
        }

        // Convert the full markdown body to HTML
        const htmlBody = marked.parse(markdownBody);
        
        // Format Tags
        const tagsHtml = tags.map(tag => {
            const tagClass = `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`;
            return `<span class="tag ${tagClass}">${tag}</span>`;
        }).join('');

        // Inject everything into the page (Now includes date)
        contentContainer.innerHTML = `
            <img class="full-article-img" src="${dataFolder}/${thumbnail}" alt="${title}" onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'">
            <div class="full-article-header">
                <h1 class="full-article-title">${title}</h1>
                <div class="meta-info">
                    ${tagsHtml}
                    ${author ? `<span class="article-author">By ${author}</span>` : ''}
                    ${date ? `<span class="article-date">${date}</span>` : ''}
                </div>
            </div>
            <div class="full-article-body">
                ${htmlBody}
            </div>
        `;
        
        // Update the browser tab title
        document.title = `${title} | RAMSC`;
        
    } catch (error) {
        console.error(error);
        contentContainer.innerHTML = "<h2>Error loading article. It may have been removed.</h2>";
    }
});