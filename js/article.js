document.addEventListener("DOMContentLoaded", () => {
    const recentContainer = document.getElementById("recent-highlights-container");
    const moreContainer = document.getElementById("more-news-container");
    const loadMoreBtn = document.getElementById("load-more-btn");

    const dataFolder = "_data";
    let articles = [];
    let visibleMoreCount = 0;
    const loadMoreAmount = 4;

    // Fetch articles sequentially (1.md, 2.md) until a 404 Not Found is hit
    async function fetchAllArticles() {
        let id = 2; // Starting at 2 based on your previous setup
        let keepFetching = true;

        while (keepFetching) {
            try {
                const mdResponse = await fetch(`${dataFolder}/${id}.md`);
                
                // Stop the loop if the file doesn't exist
                if (!mdResponse.ok) {
                    keepFetching = false;
                    break;
                }

                const mdText = await mdResponse.text();
                
                // --- YAML Frontmatter Parser ---
                let title = "Untitled";
                let tags = [];
                let thumbnail = `${id}.jpg`; // Fallback image
                let author = "";
                let date = ""; // Added date variable
                let markdownBody = mdText;

                // Regex to separate the content between the --- lines from the body
                const fmRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
                const match = mdText.match(fmRegex);

                if (match) {
                    const fmText = match[1];
                    markdownBody = match[2];

                    // Extract Title
                    const titleMatch = fmText.match(/title:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
                    if (titleMatch) title = titleMatch[1];

                    // Extract Tags
                    const tagsMatch = fmText.match(/tags:\s*\[(.*?)\]/);
                    if (tagsMatch) {
                        tags = tagsMatch[1].split(',').map(t => t.replace(/["']/g, '').trim());
                    }

                    // Extract Thumbnail name
                    const thumbMatch = fmText.match(/thumbnail:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
                    if (thumbMatch) thumbnail = thumbMatch[1];
                    
                    // Extract Author
                    const authorMatch = fmText.match(/author:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
                    if (authorMatch) author = authorMatch[1];

                    
                    // Extract and Format Date (Time Only)
                    const dateMatch = fmText.match(/date:\s*"?(.*?)"?\s*(?:\r?\n|$)/);
                    if (dateMatch) {
                        let rawDate = dateMatch[1].trim();
                        // Finds all instances of HH:MM (e.g., 09:00 and 17:00)
                        const timeMatch = rawDate.match(/\d{2}:\d{2}/g);
                        
                        if (timeMatch && timeMatch.length >= 2) {
                            date = `${timeMatch[0]} - ${timeMatch[1]}`; // Joins 09:00 and 17:00
                        } else {
                            date = rawDate; // Fallback just in case
                        }
                    }
                }

                // Convert remaining markdown text to HTML
                const htmlBody = marked.parse(markdownBody);

                // Add to our array (newest first, assuming higher ID = newer)
                articles.unshift({
                    id: id,
                    title: title,
                    content: htmlBody,
                    image: `${dataFolder}/${thumbnail}`,
                    tags: tags,
                    author: author,
                    date: date // Included date here
                });

                id++; // Move to the next number
            } catch (error) {
                console.error("Error fetching data:", error);
                keepFetching = false;
            }
        }

        renderArticles();
    }

    function createCardHTML(article) {
        // Map the parsed tags into HTML span elements
        const tagsHtml = article.tags.map(tag => {
            const tagClass = `tag-${tag.toLowerCase().replace(/\s+/g, '-')}`;
            return `<span class="tag ${tagClass}">${tag}</span>`;
        }).join('');

        return `
            <a href="read.html?id=${article.id}" class="news-card-link">
                <div class="news-card">
                    <div class="news-card-img">
                        <img src="${article.image}" alt="${article.title}" onerror="this.src='https://via.placeholder.com/250x160?text=No+Image'">
                    </div>
                    <div class="news-card-content">
                        <div class="title-fade">${article.title}</div>
                        <div class="meta-info">
                            ${tagsHtml}
                        </div>
                        <div class="paragraphs">
                            ${article.content}
                        </div>
                    </div>
                </div>
            </a>
        `;
    }

    
    function renderArticles() {
        if (articles.length === 0) return;

        // The newest article goes to Recent Highlights
        recentContainer.innerHTML = createCardHTML(articles[0]);

        // The rest go to "More News"
        visibleMoreCount = Math.min(loadMoreAmount, articles.length - 1);
        renderMoreNews(visibleMoreCount);

        // Show 'Load More' button if there are undisplayed articles
        if (articles.length - 1 > visibleMoreCount) {
            loadMoreBtn.classList.remove("hidden");
        }
    }

    function renderMoreNews(limit) {
        let html = "";
        for (let i = 1; i <= limit; i++) {
            if (articles[i]) {
                html += createCardHTML(articles[i]);
            }
        }
        moreContainer.innerHTML = html;
    }

    // Load More Button Logic
    loadMoreBtn.addEventListener("click", () => {
        const totalRemaining = (articles.length - 1) - visibleMoreCount;
        const nextBatch = Math.min(loadMoreAmount, totalRemaining);
        
        visibleMoreCount += nextBatch;
        renderMoreNews(visibleMoreCount);

        if (visibleMoreCount >= articles.length - 1) {
            loadMoreBtn.classList.add("hidden");
        }
    });

    // Start process
    fetchAllArticles();
});