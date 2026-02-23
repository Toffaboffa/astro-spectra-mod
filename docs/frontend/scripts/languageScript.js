document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedLang = urlParams.get('lang') || 'en';

    updateTextContent();

    const currentUrl = window.location.href.split('?')[0];

    if (urlParams.get('lang') == null) {
        window.location.href = `${currentUrl}?lang=${selectedLang}`;
    }

    updateButtonLinks(selectedLang);

    const selectElement = document.getElementById('language');
    if (selectElement) {
        selectElement.value = selectedLang;

        selectElement.addEventListener('change', () => {
            const newLang = selectElement.value;
            window.location.href = `${currentUrl}?lang=${newLang}`;
        });
    }
});

/**
 * Translates the words of the webpage tagged with "data-translate"
 */
function updateTextContent() {
    const urlParams = new URLSearchParams(window.location.search);
    const selectedLang = urlParams.get('lang') || 'en';

    fetch(`../languages/${selectedLang}.json`)
        .then(response => response.json())
        .then(translations => {
            document.querySelectorAll('[data-translate]').forEach(element => {
                const key = element.getAttribute('data-translate');
                const value = translations[key];
                if (value) {
                    element.innerHTML = value;
                }
            });

            document.querySelectorAll('[data-translate-title]').forEach(element => {
                const key = element.getAttribute('data-translate-title');
                const value = translations[key];
                if (value) {
                    element.setAttribute('title', value);
                }
            });

            document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
                const key = element.getAttribute('data-translate-placeholder');
                const value = translations[key];
                if (value) {
                    element.setAttribute('placeholder', value);
                }
            })
        }).catch(error => console.error("Error loading language file:", error));
}

/**
 * Updates href attributes of buttons based on the selected language
 * @param {string} lang - The selected language code
 */
function updateButtonLinks(lang) {
    const buttons = document.querySelectorAll('a');
    buttons.forEach(button => {
        if (button.href) {
            const baseHref = button.getAttribute('href').split('?')[0];
            button.setAttribute('href', `${baseHref}?lang=${lang}`);
        }
    });
}
