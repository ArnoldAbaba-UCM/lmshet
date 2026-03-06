// ==Auto Canvas Quiz Solver (New Quizzes) with Auto Next==
// Automatically extracts the current question, sends it to the API, selects the predicted answer,
// and optionally clicks the "Next" button after a delay.

(function() {
    'use strict';

    // --- Configuration ---
    const API_URL = 'https://canvasquiz-new.uc.r.appspot.com/generate';
    const PROCESS_DELAY = 500;          // ms to wait after detecting a new question (allows DOM to settle)
    const OVERRIDE_EXISTING = true;      // if true, will select even if a radio is already checked
    const AUTO_NEXT = true;              // automatically click "Next" after answering
    const NEXT_DELAY = 2000;             // ms to wait after selection before clicking "Next"

    // --- State ---
    const processedQuestions = new Set(); // stores hashes of question text to avoid reprocessing
    let observer = null;
    let statusDiv = null;

    // --- Utility: generate a simple hash from text ---
    function hashText(text) {
        let hash = 0;
        if (!text) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    // --- Extract question and options from container ---
    function extractQA(container) {
        // Question text: look inside legend .user_content first
        let questionEl = container.querySelector('legend .user_content');
        let questionText = questionEl ? questionEl.innerText.replace(/\s+/g, ' ').trim() : '';

        // Fallback: find any .user_content not inside a radio label
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

        // Options: get all radio inputs and their associated label text
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

    // --- Auto‑select the radio matching the predicted answer ---
    function autoSelectAnswer(answer, radioInputs, container) {
        if (!answer || answer === '(none)' || answer === '(API Error)') {
            console.log('⏭️ No valid answer to select');
            return false;
        }

        const normalizedAnswer = answer.toLowerCase().trim();

        // Helper to get option text for a given radio
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

        // Strategy 2: Partial match (substring)
        for (let radio of radioInputs) {
            const optText = getOptionText(radio);
            if (normalizedAnswer.includes(optText) || optText.includes(normalizedAnswer)) {
                radio.click();
                highlightSelected(radio, 'partial', optText);
                return true;
            }
        }

        // Strategy 3: Single letter (A, B, C, D)
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

    // --- Visual feedback when an option is selected ---
    function highlightSelected(radio, matchType, labelText) {
        const label = radio.closest('label');
        if (label) {
            const originalBg = label.style.backgroundColor;
            let color = '#a5f3fc'; // exact
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

    // --- Click the "Next" button if it exists and is appropriate ---
    function clickNextIfAvailable() {
        // The main navigation button in New Quizzes has this data attribute
        const navButton = document.querySelector('[data-automation="sdk-oqaat-next-or-submit-button"]');
        if (!navButton) {
            console.log('⏸️ No navigation button found');
            return false;
        }

        // Check if it's disabled or hidden
        if (navButton.disabled || navButton.offsetParent === null) {
            console.log('⏸️ Navigation button is disabled or hidden');
            return false;
        }

        // Get the visible text (the span with aria-hidden="true" contains the actual button label)
        const visibleSpan = navButton.querySelector('[aria-hidden="true"]');
        const buttonText = visibleSpan ? visibleSpan.innerText.trim().toLowerCase() : navButton.innerText.trim().toLowerCase();

        // If the button says "submit" or "finish", we're at the end – do not click
        if (buttonText.includes('submit') || buttonText.includes('finish')) {
            console.log('🏁 Submit/Finish button detected – auto‑next stopped (end of quiz)');
            updateStatus('End of quiz');
            return false;
        }

        // If it says "next", click it
        if (buttonText.includes('next')) {
            navButton.click();
            console.log('⏩ Auto‑next clicked');
            updateStatus('Next clicked');
            return true;
        }

        console.log('⏸️ Navigation button text is not "next":', buttonText);
        return false;
    }

    // --- Main processing function ---
    async function processQuestion(container) {
        // If no container, nothing to do
        if (!container) return;

        // Extract QA
        const { questionText, options, radioInputs } = extractQA(container);
        if (!questionText || options.length === 0) {
            console.warn('⚠️ Could not extract question or options');
            return;
        }

        // Check if already processed (using hash of question text)
        const qHash = hashText(questionText);
        if (processedQuestions.has(qHash)) {
            console.log('⏭️ Question already processed, skipping');
            return;
        }

        // If a radio is already selected and we don't override, skip
        const anySelected = radioInputs.some(r => r.checked);
        if (anySelected && !OVERRIDE_EXISTING) {
            console.log('⏭️ Question already answered (radio checked) and OVERRIDE_EXISTING=false, skipping');
            return;
        }

        console.log('📝 Question:', questionText);
        console.log('📋 Options:', options);

        // Build payload and call API
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

            // Auto‑select
            const selected = autoSelectAnswer(answer, radioInputs, container);
            if (selected) {
                processedQuestions.add(qHash);
                updateStatus(`Last: ${questionText.substring(0, 30)}… → ${answer.substring(0, 20)}`);

                // Auto‑next after delay if enabled
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

    // --- UI: small status panel ---
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
        statusDiv.innerHTML = `🤖 Auto Solver: <span id="solver-status-text">Active</span>`;
        document.body.appendChild(statusDiv);
    }

    function updateStatus(text) {
        const span = document.getElementById('solver-status-text');
        if (span) span.innerText = text || 'Active';
    }

    // --- Observer: watch for new quiz containers ---
    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    // Check if any added node contains the quiz container
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // element
                            // Look for the container within the added node
                            const container = node.querySelector?.('[data-automation="sdk-item-wrapper"], [data-automation="sdk-take-item-question"]') ||
                                              (node.matches && (node.matches('[data-automation="sdk-item-wrapper"]') || node.matches('[data-automation="sdk-take-item-question"]')) ? node : null);
                            if (container) {
                                console.log('🔄 New question container detected');
                                // Delay to allow full render
                                setTimeout(() => processQuestion(container), PROCESS_DELAY);
                                // Break after first container found (should only be one per page)
                                return;
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('👀 Observer started – waiting for questions...');
    }

    // --- Also run on initial page load in case the question is already there ---
    function handleInitial() {
        const container = document.querySelector('[data-automation="sdk-item-wrapper"], [data-automation="sdk-take-item-question"]');
        if (container) {
            console.log('📌 Found question on page load');
            setTimeout(() => processQuestion(container), PROCESS_DELAY);
        }
    }

    // --- Initialize everything ---
    function init() {
        createStatusPanel();
        startObserver();
        handleInitial();
        console.log('🚀 Auto Canvas Quiz Solver (with Auto Next) started');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
