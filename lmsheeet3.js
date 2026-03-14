// ==Auto Canvas Quiz Solver (New Quizzes) with Auto Next==
// Automatically extracts the current question, sends it to the API, selects the predicted answer,
// and optionally clicks the "Next" button after a delay.

(function() {
    'use strict';

    // --- Configuration ---
    const API_URL = 'https://canvasquiz-new.uc.r.appspot.com/generate';
    const PROCESS_DELAY = 800;          // ms to wait after detecting a new question
    const OVERRIDE_EXISTING = true;      // if true, will select even if a radio is already checked
    const AUTO_NEXT = true;              // automatically click "Next" after answering
    const NEXT_DELAY = 2000;             // ms to wait after selection before clicking "Next"

    // --- State ---
    const processedQuestions = new Set();
    let observer = null;
    let statusDiv = null;

    // --- Utility: simple hash ---
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

    // --- Extract question and options from container ---
    function extractQA(container) {
        // First, try to get the innermost wrapper (sdk-item-wrapper) if present
        const innerWrapper = container.querySelector('[data-automation="sdk-item-wrapper"]');
        const root = innerWrapper || container;

        console.log('🔍 Extracting from:', root);

        // ----- Question text -----
        let questionText = '';

        // Try the most specific selector: fieldset[role="radiogroup"] legend .user_content
        const fieldset = root.querySelector('fieldset[role="radiogroup"]');
        if (fieldset) {
            const legendUC = fieldset.querySelector('legend .user_content');
            if (legendUC) {
                questionText = legendUC.innerText.replace(/\s+/g, ' ').trim();
                console.log('📝 Found via fieldset legend:', questionText);
            }
        }

        // Fallback: any legend .user_content
        if (!questionText) {
            const legendUC = root.querySelector('legend .user_content');
            if (legendUC) {
                questionText = legendUC.innerText.replace(/\s+/g, ' ').trim();
                console.log('📝 Found via legend:', questionText);
            }
        }

        // Last resort: find any .user_content not inside a radio label
        if (!questionText) {
            const allUC = Array.from(root.querySelectorAll('.user_content'));
            const radioLabels = root.querySelectorAll('input[type="radio"]');
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
                    if (questionText) {
                        console.log('📝 Found via fallback (non‑option .user_content):', questionText);
                        break;
                    }
                }
            }
        }

        // ----- Options -----
        const radioInputs = Array.from(root.querySelectorAll('input[type="radio"]'));
        console.log(`🔢 Found ${radioInputs.length} radio inputs.`);

        const options = [];
        radioInputs.forEach(radio => {
            let label = null;

            // Method 1: label[for="radio-id"]
            if (radio.id) {
                label = root.querySelector(`label[for="${radio.id}"]`);
            }

            // Method 2: look for a label inside the same parent container
            if (!label && radio.parentElement) {
                label = radio.parentElement.querySelector('label');
            }

            // Method 3: closest label
            if (!label) {
                label = radio.closest('label');
            }

            if (label) {
                const uc = label.querySelector('.user_content');
                const optionText = (uc ? uc.innerText : label.innerText).replace(/\s+/g, ' ').trim();
                if (optionText) options.push(optionText);
            }
        });

        // Fallback if radio‑based method fails: look for labels with class containing "radioInput__control"
        if (options.length === 0) {
            console.warn('⚠️ No options found via radio inputs, trying fallback label selector...');
            const fallbackLabels = Array.from(root.querySelectorAll('label[class*="radioInput__control"]'));
            fallbackLabels.forEach(label => {
                const uc = label.querySelector('.user_content');
                const optionText = (uc ? uc.innerText : label.innerText).replace(/\s+/g, ' ').trim();
                if (optionText) options.push(optionText);
            });
        }

        console.log('📋 Extracted options:', options);

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

    // --- Click the "Next" button ---
    function clickNextIfAvailable() {
        const navButton = document.querySelector('[data-automation="sdk-oqaat-next-or-submit-button"]');
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
            console.log('🏁 Submit/Finish button detected – auto‑next stopped (end of quiz)');
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

    // --- Main processing function ---
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
            console.log('⏭️ Question already answered (radio checked) and OVERRIDE_EXISTING=false, skipping');
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
                    setTimeout(clickNextIfAvailable, NEXT_DELAY);
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
        statusDiv.innerHTML = `🤖 Group 5 Solver: <span id="solver-status-text">Active</span>`;
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
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            const container = node.querySelector?.('[data-automation="sdk-item-wrapper"], [data-automation="sdk-take-item-question"]') ||
                                              (node.matches && (node.matches('[data-automation="sdk-item-wrapper"]') || node.matches('[data-automation="sdk-take-item-question"]')) ? node : null);
                            if (container) {
                                console.log('🔄 New question container detected');
                                setTimeout(() => processQuestion(container), PROCESS_DELAY);
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

    // --- Also run on initial page load ---
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
        console.log('💡 If extraction fails, check the console logs for details.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
