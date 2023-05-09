/*
    🛸 Mothership on Main Interactivity
    A script that enables interactivity on the home page
    Author: Dean Tammam
    Date: 4/20/2023
*/

/*
CYCLE THROUGH QUOTES
- Enables the page to load a different snippet of feedback on page load
- text array below can be updated to include different feedback
*/

    // Define an array of text to choose from
    const texts =[
        "Time is like a river that carries us forward into encounters with reality that require us to make decisions. We can't stop our movement down this river and we can't avoid those encounters. We can only approach them in the best possible way. (Ray Dalio)",
        "We cannot solve problems with the kind of thinking we employed when we came up with them (Albert Einstein)",
        "Machines are better than me at whatever they're for. That's the point of tools. A calculator is better than me at 238÷182 and a bucket is better than me at holding water. (Cassie Kozyrkov)",
        "History is the future. (Bob Steel)",
        "Have your opinion, don't let your opinion have you. (Patrice O'Neal)",
        "Goal setting is the secret to a compelling future (Tony Robbins)"
    ];

    // Select a random text bit
    const randomText = texts[Math.floor(Math.random() * texts.length)];

    // Find the HTML element where you want to display the text
    const textContainer = document.getElementById("text-container");

    // Set the text of the element to the random selected text
    textContainer.textContent = randomText;

/*
MULTI-SEARCH MENU
- Enables the form to search across various providers, accounting for querying string
- Requires a paired search-engine value to interact with 
*/

    // Add the event listener
    document.addEventListener('DOMContentLoaded', function() {

        // Map to the HTML element
        const searchForm = document.getElementById('search-form');
        const searchEngine = document.getElementById('search-engine');
        const searchInput = document.getElementById('search-input');
        searchEngine.addEventListener('change', function() {
            updateSearchEngine(searchEngine.value);
        });

        // Pick the appropriate action based on the selected dropdown item
        function updateSearchEngine(engine) {
            switch (engine) {
                case 'google':
                    searchForm.action = 'https://www.google.com/search';
                    searchInput.name = 'q';
                    break;

                case 'bing':
                    searchForm.action = 'https://www.bing.com/search';
                    searchInput.name = 'q';
                    break;

                case 'duckduckgo':
                    searchForm.action = 'htt[s://www.duckduckgo.com/';
                    searchInput.name = 'q';
                    break;

                case 'wikipedia':
                    searchForm.action = 'https://en.wikipedia.org/w/index.php';
                    searchInput.name = 'search';
                    break;

                case 'microsoft':
                    searchForm.action = 'https://learn.microsoft.com/en-us/search/?terms=';
                    searchInput.name = 'search';
                    break;

                }  
            }
            // Set the search engine (Google)
            updateSearchEngine(searchEngine.value);
    });

/*
BACKGROUND CYCLER
- Enables the page to cycle between local files or background image URLs
- Files are located in the /images folder of the project
*/

    // Define an array of background image URLs
    var backgroundImageURLs = [
        "images/pexels-alex-fu-4815497.jpg",
        "images/pexels-francesco-ungaro-3218443.jpg",
        "images/pexels-eberhard-grossgasteiger-572897.jpg",
        "images/pexels-andy-vu-3244513.jpg",
        "images/pexels-greg-2418664.jpg",
        "images/pexels-greg-2418664.jpg",
        "images/pexels-johannes-plenio-1996042.jpg",
    ]

    // Select a random image
    var randomNumber = Math.floor(Math.random() * backgroundImageURLs.length);

    // Set the background image of the body element to the randomly selected file
    document.body.style.backgroundImage = "url('" + backgroundImageURLs[randomNumber] + "')";