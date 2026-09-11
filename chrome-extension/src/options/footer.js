(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.OptionsFooter = api;
        api.registerFooter(document, chrome.runtime);
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function initializeFooter(documentObject, runtime) {
        const manifest = runtime.getManifest();
        documentObject.getElementById('extension-version').textContent = manifest.version;
    }

    function registerFooter(documentObject, runtime) {
        documentObject.addEventListener('DOMContentLoaded', () => {
            initializeFooter(documentObject, runtime);
        });
    }

    return { initializeFooter, registerFooter };
}));
