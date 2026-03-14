// ==Auto Canvas Quiz Solver (New Quizzes) with Auto Next==
// Updated to work inside the LTI iframe.

(function() {
    'use strict';

    // --- Configuration ---
    const API_URL = 'https://canvasquiz-new.uc.r.appspot.com/generate';
    const PROCESS_DELAY = 500;          // ms to wait after detecting a new question
    const OVERRIDE_EXISTING = true;
    const AUTO_NEXT = true;
    const NEXT_DELAY = 2000;

    // --- State ---
    const processedQuestions = new Set();
    let observer = null;
    let statusDiv = null;
    let quizFrame = null;                // will hold the iframe element

    // --- Utility: generate a simple hash from text ---
    function hashText(text) {
        let hash = 0;
        if (!text) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // --- Get the document inside the quiz iframe ---
    function getQuizDocument() {
        if (!quizFrame) {
            // Try to find the iframe – it may have a dynamic ID, but from your HTML it's "tool_content_994"
            quizFrame = document.getElementById('tool_content_994');
            // If not found, fallback to a selector that might match
            if (!quizFrame) {
                quizFrame = document.querySelector('iframe.tool_launch');
            }
        }
        if (quizFrame && quizFrame.contentDocument) {
            return quizFrame.contentDocument;
        }
        return null;
    }

    // --- Extract question and options from container (inside iframe) ---
    function extractQA(container) {
        // (Your existing extractQA logic – unchanged, but it will be called with elements from the iframe)
        let questionEl = container.querySelector('legend .user_content');
        let questionText = questionEl ? questionEl.innerText.replace(/\s+/g, ' ').trim() : '';

        if (!questionText) {
            const allUC = Array.from(container.querySelectorAll('.user_content'));
            const radioLabels = container.querySelectorAll('input[type="radio"]');
            const ucInsideOptions = new Set();
            radioLabels.forEach(radio => {
                const label = radio.closest('label') || radio.parentElement?.querySelector('label');
                if (label) {
                    const uc = label.querySelector('.user_content');
                    if (uc) ucInsideOptions.add(uc);
                }
            });
            for (const uc of allUC) {
                if (!ucInsideOptions.has(uc)) {
                    questionText = uc.innerText.replace(/\s+/g, ' ').trim();
                    if (questionText) break;
                }
            }
        }

        const radioInputs = Array.from(container.querySelectorAll('input[type="radio"]'));
        const options = radioInputs.map(radio => {
            let label = container.querySelector(`label[for="${radio.id}"]`);
            if (!label && radio.parentElement) {
                label = radio.parentElement.querySelector('label');
            }
            if (!label) {
                label = radio.closest('label');
            }
            if (label) {
                const uc = label.querySelector('.user_content');
                return (uc ? uc.innerText : label.innerText).replace(/\s+/g, ' ').trim();
            }
            return '';
        }).filter(text => text.length > 0);

        return { questionText, options, radioInputs };
    }

    // --- Auto‑select the radio matching the predicted answer (unchanged) ---
    function autoSelectAnswer(answer, radioInputs, container) {
        if (!answer || answer === '(none)' || answer === '(API Error)') {
            console.log('⏭️ No valid answer to select');
            return false;
        }

        const normalizedAnswer = answer.toLowerCase().trim();

        function getOptionText(radio) {
            const label = radio.closest('label') || container.querySelector(`label[for="${radio.id}"]`);
            if (label) {
                const uc = label.querySelector('.user_content');
                return (uc ? uc.innerText : label.innerText).replace(/\s+/g, ' ').trim().toLowerCase();
            }
            return '';
        }

        // Strategy 1: Exact match
        for (let radio of radioInputs) {
            const optText = getOptionText(radio);
            if (optText === normalizedAnswer) {
                radio.click();
                highlightSelected(radio, 'exact', optText);
                return true;
            }
        }

        // Strategy 2: Partial match
        for (let radio of radioInputs) {
            const optText = getOptionText(radio);
            if (normalizedAnswer.includes(optText) || optText.includes(normalizedAnswer)) {
                radio.click();
                highlightSelected(radio, 'partial', optText);
                return true;
            }
        }

        // Strategy 3: Single letter
        if (normalizedAnswer.length === 1 && /[a-d]/i.test(normalizedAnswer)) {
            const index = normalizedAnswer.charCodeAt(0) - 'a'.charCodeAt(0);
            if (index >= 0 && index < radioInputs.length) {
                radioInputs[index].click();
                highlightSelected(radioInputs[index], 'letter', `Option ${normalizedAnswer.toUpperCase()}`);
                return true;
            }
        }

        // Strategy 4: Smart keyword scoring
        const answerWords = normalizedAnswer.split(/\s+/).filter(w => w.length > 2);
        let bestScore = 0;
        let bestRadio = null;
        for (let radio of radioInputs) {
            const optText = getOptionText(radio);
            let score = 0;
            answerWords.forEach(word => {
                if (optText.includes(word)) score += word.length * 2;
            });
            if (score > bestScore) {
                bestScore = score;
                bestRadio = radio;
            }
        }
        if (bestRadio && bestScore > 0) {
            bestRadio.click();
            highlightSelected(bestRadio, 'smart', `(score ${bestScore})`);
            return true;
        }

        console.warn('❌ Could not match answer to any option');
        return false;
    }

    // --- Visual feedback (unchanged) ---
    function highlightSelected(radio, matchType, labelText) {
        const label = radio.closest('label');
        if (label) {
            const originalBg = label.style.backgroundColor;
            let color = '#a5f3fc';
            if (matchType === 'partial') color = '#fed7aa';
            else if (matchType === 'letter') color = '#c4b5fd';
            else if (matchType === 'smart') color = '#fde047';

            label.style.backgroundColor = color;
            label.style.transition = 'background-color 0.5s';
            setTimeout(() => {
                label.style.backgroundColor = originalBg;
            }, 2000);
        }
        console.log(`✅ Selected (${matchType}): ${labelText || radio.value}`);
    }

    // --- Click the "Next" button (now inside iframe) ---
    function clickNextIfAvailable() {
        const doc = getQuizDocument();
        if (!doc) return false;

        const navButton = doc.querySelector('[data-automation="sdk-oqaat-next-or-submit-button"]');
        if (!navButton) {
            console.log('⏸️ No navigation button found');
            return false;
        }

        if (navButton.disabled || navButton.offsetParent === null) {
            console.log('⏸️ Navigation button is disabled or hidden');
            return false;
        }

        const visibleSpan = navButton.querySelector('[aria-hidden="true"]');
        const buttonText = visibleSpan ? visibleSpan.innerText.trim().toLowerCase() : navButton.innerText.trim().toLowerCase();

        if (buttonText.includes('submit') || buttonText.includes('finish')) {
            console.log('🏁 Submit/Finish button detected – auto‑next stopped');
            updateStatus('End of quiz');
            return false;
        }

        if (buttonText.includes('next')) {
            navButton.click();
            console.log('⏩ Auto‑next clicked');
            updateStatus('Next clicked');
            return true;
        }

        console.log('⏸️ Navigation button text is not "next":', buttonText);
        return false;
    }

    // --- Main processing function (uses iframe document) ---
    async function processQuestion(container) {
        if (!container) return;

        const { questionText, options, radioInputs } = extractQA(container);
        if (!questionText || options.length === 0) {
            console.warn('⚠️ Could not extract question or options');
            return;
        }

        const qHash = hashText(questionText);
        if (processedQuestions.has(qHash)) {
            console.log('⏭️ Question already processed, skipping');
            return;
        }

        const anySelected = radioInputs.some(r => r.checked);
        if (anySelected && !OVERRIDE_EXISTING) {
            console.log('⏭️ Question already answered and OVERRIDE_EXISTING=false, skipping');
            return;
        }

        console.log('📝 Question:', questionText);
        console.log('📋 Options:', options);

        const payload = { id: 0, question: questionText, options: options.join(' || ') };
        console.log('📤 Sending to API...');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const answer = (data && data.answer) ? String(data.answer).trim() : '(none)';
            console.log('✅ API response:', data);
            console.log('🎯 Predicted answer:', answer);

            const selected = autoSelectAnswer(answer, radioInputs, container);
            if (selected) {
                processedQuestions.add(qHash);
                updateStatus(`Last: ${questionText.substring(0, 30)}… → ${answer.substring(0, 20)}`);

                if (AUTO_NEXT) {
                    setTimeout(() => {
                        clickNextIfAvailable();
                    }, NEXT_DELAY);
                }
            } else {
                updateStatus('No match found');
            }
        } catch (error) {
            console.warn('❌ API error:', error);
            updateStatus('API error');
        }
    }

    // --- Observer that watches the iframe's document for new question containers ---
    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            // Look for the container inside the iframe's document
                            const container = node.querySelector?.('[data-automation="sdk-item-wrapper"], [data-automation="sdk-take-item-question"]') ||
                                              (node.matches && (node.matches('[data-automation="sdk-item-wrapper"]') || node.matches('[data-automation="sdk-take-item-question"]')) ? node : null);
                            if (container) {
                                console.log('🔄 New question container detected inside iframe');
                                setTimeout(() => processQuestion(container), PROCESS_DELAY);
                                return;
                            }
                        }
                    }
                }
            }
        });

        const doc = getQuizDocument();
        if (doc) {
            observer.observe(doc.body, { childList: true, subtree: true });
            console.log('👀 Observer started inside iframe');
        } else {
            console.warn('⚠️ Could not access iframe document to start observer');
        }
    }

    // --- Check for an initial question when the iframe loads ---
    function handleInitial() {
        const doc = getQuizDocument();
        if (!doc) return;

        const container = doc.querySelector('[data-automation="sdk-item-wrapper"], [data-automation="sdk-take-item-question"]');
        if (container) {
            console.log('📌 Found question on page load');
            setTimeout(() => processQuestion(container), PROCESS_DELAY);
        }
    }

    // --- UI: small status panel (unchanged) ---
    function createStatusPanel() {
        if (statusDiv) return;
        statusDiv = document.createElement('div');
        statusDiv.id = 'canvas-auto-solver-status';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #1e293b;
            color: #e2e8f0;
            padding: 8px 12px;
            border-radius: 20px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid #475569;
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        statusDiv.innerHTML = `🤖 Auto Solver: <span id="solver-status-text">Waiting for iframe...</span>`;
        document.body.appendChild(statusDiv);
    }

    function updateStatus(text) {
        const span = document.getElementById('solver-status-text');
        if (span) span.innerText = text || 'Active';
    }

    // --- Wait for the iframe to load, then initialize ---
    function waitForIframeAndStart() {
        quizFrame = document.getElementById('tool_content_994') || document.querySelector('iframe.tool_launch');
        if (!quizFrame) {
            console.warn('⏳ Quiz iframe not found, retrying in 1s...');
            setTimeout(waitForIframeAndStart, 1000);
            return;
        }

        // If the iframe is already loaded, its contentDocument may be accessible immediately.
        // If not, listen for the load event.
        if (quizFrame.contentDocument && quizFrame.contentDocument.readyState === 'complete') {
            console.log('✅ Iframe already loaded');
            startObserver();
            handleInitial();
            updateStatus('Active');
        } else {
            quizFrame.addEventListener('load', () => {
                console.log('✅ Iframe loaded');
                startObserver();
                handleInitial();
                updateStatus('Active');
            });
        }
    }

    // --- Initialize everything ---
    function init() {
        createStatusPanel();
        waitForIframeAndStart();
        console.log('🚀 Auto Canvas Quiz Solver (iframe‑aware) started');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
