// CANVAS QUIZ BOT WITH NOTES-FIRST PRIORITY
//GAGI INTELLIGENT ANSWER SYSTEM
(async function() {
    console.log('🎯 NIGGA NOTES-FIRST QUIZ BOT ACTIVATED...');
    
    class NotesFirstQuizBot {
        constructor() {
            this.allNotesContent = '';
            this.fileInput = null;
            this.processedQuestions = new Set();
            this.notesLoaded = false;
            this.botActive = false;
        }

        generateQuestionHash(text) {
            try {
                // Method 1: Try simple btoa with encoding
                return btoa(unescape(encodeURIComponent(text))).substring(0, 20);
            } catch (error) {
                try {
                    // Method 2: Use character codes as fallback
                    let hash = 0;
                    for (let i = 0; i < text.length; i++) {
                        const char = text.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash; // Convert to 32bit integer
                    }
                    return Math.abs(hash).toString(36).substring(0, 10);
                } catch (fallbackError) {
                    // Method 3: Simple substring as last resort
                    return text.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '');
                }
            }
        }

        initializeFileInput() {
            // Create file input for notes files
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.multiple = true;
            this.fileInput.accept = '.txt,.md,.doc,.docx,.pdf,.json';
            this.fileInput.style.display = 'none';
            
            this.fileInput.addEventListener('change', (event) => {
                this.processNotesFiles(event.target.files);
            });
            
            document.body.appendChild(this.fileInput);
            
            // Create upload button
            const uploadBtn = document.createElement('button');
            uploadBtn.innerHTML = '📚 Load Notes Files';
            uploadBtn.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 10000;
                background: #2d3748;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-family: monospace;
                font-size: 12px;
            `;
            uploadBtn.onclick = () => this.fileInput.click();
            document.body.appendChild(uploadBtn);
            
            console.log('✅ Notes input initialized - Click "Load Notes Files" to add your study notes');
        }

        async processNotesFiles(files) {
            console.log(`📚 Processing ${files.length} notes file(s)...`);
            this.allNotesContent = '';
            this.notesLoaded = false;
            this.botActive = false;
            
            let totalSize = 0;
            for (let file of files) {
                try {
                    const content = await this.readFileContent(file);
                    this.allNotesContent += `\n\n--- ${file.name} ---\n${content}`;
                    totalSize += content.length;
                    console.log(`✅ Loaded: ${file.name} (${content.length} chars)`);
                } catch (error) {
                    console.error(`❌ Error reading ${file.name}:`, error);
                }
            }
            
            this.notesLoaded = true;
            this.botActive = true;
            console.log(`📊 Total notes content: ${totalSize} characters`);
            console.log('✅ Notes ready for AI analysis - Bot is now ACTIVE');
            
            this.updateStatus();
            
            // Process current question with notes
            this.processCurrentQuestion();
        }

        readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        extractCurrentQuestion() {
            const container =
                document.querySelector('[data-automation="sdk-item-wrapper"]') ||
                document.querySelector('[data-automation="sdk-take-item-question"]');

            if (!container) {
                console.warn('❌ No New Quizzes container found');
                return null;
            }

            function extractQA(root) {
                const optionLabels = Array.from(root.querySelectorAll('label[class*="radioInput__control"]'));
                const allUC = Array.from(root.querySelectorAll('.user_content'));
                const ucInsideOptions = new Set(optionLabels.flatMap(l => Array.from(l.querySelectorAll('.user_content'))));
                
                let questionText = '';
                for (const uc of allUC) {
                    if (!ucInsideOptions.has(uc)) {
                        questionText = uc.innerText.replace(/\s+/g,' ').trim();
                        if (questionText) break;
                    }
                }
                
                const options = optionLabels.map(l => 
                    (l.querySelector('.user_content')?.innerText || l.innerText || '')
                    .replace(/\s+/g,' ')
                    .trim()
                );
                
                return { questionText, options };
            }

            return extractQA(container || document);
        }

        debugOptions() {
            const optionLabels = Array.from(document.querySelectorAll('label[class*="radioInput__control"]'));
            console.log('🔍 DEBUG - Available options:');
            optionLabels.forEach((label, index) => {
                const optionText = (label.querySelector('.user_content')?.innerText || label.innerText || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const radioInput = label.querySelector('input[type="radio"]');
                const isChecked = radioInput ? radioInput.checked : false;
                console.log(`  ${index}: "${optionText}" ${isChecked ? '[CHECKED]' : ''}`);
            });
        }

        async findAnswerInNotes(questionText, options) {
            if (!this.notesLoaded || !this.allNotesContent) {
                return null;
            }

            console.log('🔍 Searching notes for answer...');
            
            try {
                // Create enhanced payload with notes
                const payload = { 
                    id: 0, 
                    question: questionText, 
                    options: options.join(' || '),
                    notes: this.allNotesContent.substring(0, 8000) // Limit notes size
                };
                
                console.log('📚 Sending question + notes to API for analysis...');
                
                const response = await fetch('https://canvasquiz-new.uc.r.appspot.com/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const notesAnswer = (data && data.answer) ? String(data.answer).trim() : null;
                    
                    if (notesAnswer && notesAnswer !== '(none)') {
                        console.log(`✅ Notes analysis found: ${notesAnswer}`);
                        return notesAnswer;
                    }
                }
            } catch (error) {
                console.warn('❌ Notes analysis failed:', error);
            }
            
            return null;
        }

        async getAPIAnswer(questionText, options) {
            try {
                const payload = { 
                    id: 0, 
                    question: questionText, 
                    options: options.join(' || ') 
                };
                
                console.log('🌐 Calling API for answer...');
                
                const response = await fetch('https://canvasquiz-new.uc.r.appspot.com/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return (data && data.answer) ? String(data.answer).trim() : '(none)';
                } else {
                    throw new Error('HTTP ' + response.status);
                }
            } catch (error) {
                console.warn('❌ API error:', error);
                return '(API Error)';
            }
        }

        async processCurrentQuestion() {
            // Don't process if notes aren't loaded yet
            if (!this.botActive) {
                console.log('⏳ Bot inactive - waiting for notes to be loaded...');
                return;
            }

            const qa = this.extractCurrentQuestion();
            if (!qa || !qa.questionText) {
                console.warn('❌ No question found');
                return;
            }

            // Check if we already processed this question
            const questionHash = this.generateQuestionHash(qa.questionText);
            if (this.processedQuestions.has(questionHash)) {
                console.log('⏭️ Question already processed, skipping...');
                return;
            }

            console.log('📝 Question:', qa.questionText);
            this.debugOptions();

            let finalAnswer = '(none)';
            let source = 'NOTES + API';
            let notesUsed = this.notesLoaded;

            // ALWAYS use notes + API approach when notes are loaded
            if (this.notesLoaded) {
                const notesAnswer = await this.findAnswerInNotes(qa.questionText, qa.options);
                if (notesAnswer && notesAnswer !== '(none)') {
                    finalAnswer = notesAnswer;
                    console.log(`✅ Using notes-based answer: ${finalAnswer}`);
                } else {
                    // If notes don't help, fall back to regular API
                    finalAnswer = await this.getAPIAnswer(qa.questionText, qa.options);
                    source = 'API (notes no help)';
                    console.log(`✅ Using API fallback answer: ${finalAnswer}`);
                }
            }

            // Auto-select answer if found
            if (finalAnswer && finalAnswer !== '(none)' && finalAnswer !== '(API Error)') {
                this.autoSelectAnswer(qa.options, finalAnswer);
            }

            // Send to Discord
            await this.sendToDiscord(qa.questionText, qa.options, finalAnswer, source, notesUsed);
            
            // Mark as processed
            this.processedQuestions.add(questionHash);
            this.updateStatus();
        }

        autoSelectAnswer(options, answer) {
            try {
                const normalizedAnswer = answer.toLowerCase().trim();
                const optionLabels = Array.from(document.querySelectorAll('label[class*="radioInput__control"]'));
                
                console.log(`🎯 Looking for: "${normalizedAnswer}" among ${optionLabels.length} options`);
                
                let foundMatch = false;
                
                // Strategy 1: Exact text match
                for (let label of optionLabels) {
                    const optionText = (label.querySelector('.user_content')?.innerText || label.innerText || '')
                        .toLowerCase()
                        .trim();
                    
                    console.log(`🔍 Option: "${optionText}"`);
                    
                    // Check for exact match
                    if (optionText === normalizedAnswer) {
                        const radioInput = label.querySelector('input[type="radio"]');
                        if (radioInput && !radioInput.checked) {
                            radioInput.click();
                            console.log(`✅ Exact match selected: "${optionText}"`);
                            this.createSelectionFeedback(label, optionText, 'exact');
                            foundMatch = true;
                            break;
                        }
                    }
                }
                
                // Strategy 2: Partial match (if exact fails)
                if (!foundMatch) {
                    for (let label of optionLabels) {
                        const optionText = (label.querySelector('.user_content')?.innerText || label.innerText || '')
                            .toLowerCase()
                            .trim();
                        
                        // Check if answer contains option text or option contains answer
                        if (normalizedAnswer.includes(optionText) || optionText.includes(normalizedAnswer)) {
                            const radioInput = label.querySelector('input[type="radio"]');
                            if (radioInput && !radioInput.checked) {
                                radioInput.click();
                                console.log(`✅ Partial match selected: "${optionText}"`);
                                this.createSelectionFeedback(label, optionText, 'partial');
                                foundMatch = true;
                                break;
                            }
                        }
                    }
                }
                
                // Strategy 3: Letter matching (A, B, C, D)
                if (!foundMatch && normalizedAnswer.length === 1) {
                    const letterIndex = 'abcdefghijklmnopqrstuvwxyz'.indexOf(normalizedAnswer);
                    if (letterIndex >= 0 && letterIndex < optionLabels.length) {
                        const radioInput = optionLabels[letterIndex].querySelector('input[type="radio"]');
                        if (radioInput && !radioInput.checked) {
                            radioInput.click();
                            console.log(`✅ Letter match selected: Option ${normalizedAnswer.toUpperCase()}`);
                            this.createSelectionFeedback(optionLabels[letterIndex], `Option ${normalizedAnswer.toUpperCase()}`, 'letter');
                            foundMatch = true;
                        }
                    }
                }
                
                // Strategy 4: Smart keyword matching
                if (!foundMatch) {
                    this.findBestOptionMatch(options, normalizedAnswer);
                }
                
                if (!foundMatch) {
                    console.warn('❌ No suitable option found for auto-selection');
                }
                
            } catch (error) {
                console.warn('⚠️ Could not auto-select answer:', error);
            }
        }

        findBestOptionMatch(options, answer) {
            console.log('🔍 Using smart keyword matching...');
            
            const answerWords = answer.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            let bestOption = null;
            let bestScore = 0;
            
            options.forEach((option, index) => {
                const optionLower = option.toLowerCase();
                let score = 0;
                
                // Score based on keyword matches
                answerWords.forEach(word => {
                    if (optionLower.includes(word)) {
                        score += word.length * 2; // Longer words get more weight
                    }
                });
                
                // Bonus for matching the beginning of words
                const optionWords = optionLower.split(/\s+/);
                answerWords.forEach(answerWord => {
                    optionWords.forEach(optionWord => {
                        if (optionWord.startsWith(answerWord) || answerWord.startsWith(optionWord)) {
                            score += 5;
                        }
                    });
                });
                
                console.log(`📊 Option ${index} score: ${score} - "${option}"`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = index;
                }
            });
            
            if (bestOption !== null && bestScore > 0) {
                const optionLabels = Array.from(document.querySelectorAll('label[class*="radioInput__control"]'));
                if (optionLabels[bestOption]) {
                    const radioInput = optionLabels[bestOption].querySelector('input[type="radio"]');
                    if (radioInput && !radioInput.checked) {
                        radioInput.click();
                        console.log(`✅ Best match selected (score: ${bestScore}): "${options[bestOption]}"`);
                        this.createSelectionFeedback(optionLabels[bestOption], options[bestOption], 'smart-match');
                        return true;
                    }
                }
            }
            
            console.warn('❌ No good match found with keyword analysis');
            return false;
        }

        createSelectionFeedback(element, optionText, type) {
            const colors = {
                'exact': '#10b981',
                'partial': '#3b82f6', 
                'letter': '#8b5cf6',
                'smart-match': '#f59e0b',
                'notes': '#10b981'
            };
            
            const labels = {
                'exact': 'EXACT MATCH',
                'partial': 'PARTIAL MATCH',
                'letter': 'LETTER MATCH',
                'smart-match': 'SMART MATCH',
                'notes': 'NOTES'
            };
            
            const color = colors[type] || '#10b981';
            const label = labels[type] || 'MATCH';
            
            const feedback = document.createElement('div');
            feedback.innerHTML = `
                <div style="
                    position: fixed;
                    top: 50px;
                    right: 10px;
                    background: ${color};
                    color: white;
                    padding: 10px;
                    border-radius: 5px;
                    z-index: 10001;
                    font-family: monospace;
                    font-size: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                ">
                    ✅ ${label}: "${optionText.substring(0, 30)}..."
                </div>
            `;
            document.body.appendChild(feedback);
            
            setTimeout(() => feedback.remove(), 3000);
        }

        async sendToDiscord(question, options, answer, source, notesUsed) {
            const webhookUrl = "https://discord.com/api/webhooks/1431705533265612800/WPYzHT3vv-lqf0ivtutb76necDHWy_sFlIpKGBnlYW2bZKTm0Q6p3-HPdNKShwATZf0j";
            
            // Format options with line breaks
            const formattedOptions = options.map(opt => `• ${opt}`).join('\n');
            
            const message = `
{
question: ${question}

Options:
${formattedOptions}

answer: ${answer}

------------------------}
            `.trim();
            
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: message,
                        username: 'lobot-notes'
                    })
                });

                if (response.ok) {
                    console.log('✅ Sent to Discord');
                } else {
                    console.log('❌ Discord send failed');
                }
            } catch (error) {
                console.error('❌ Discord Error:', error);
            }
        }

        startAutoMonitor() {
            // Monitor for new questions
            const observer = new MutationObserver((mutations) => {
                let shouldProcess = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                const hasQuizContent = node.querySelector?.('[data-automation="sdk-item-wrapper"]') || 
                                                     node.querySelector?.('[data-automation="sdk-take-item-question"]');
                                if (hasQuizContent) {
                                    shouldProcess = true;
                                }
                            }
                        });
                    }
                });
                
                if (shouldProcess) {
                    setTimeout(() => {
                        this.processCurrentQuestion();
                    }, 1500);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('👀 Auto-monitor started - waiting for notes to be loaded...');
        }

        showStatusPanel() {
            const panel = document.createElement('div');
            panel.innerHTML = `
                <div style="
                    position: fixed;
                    top: 80px;
                    right: 10px;
                    background: #1a202c;
                    color: #e2e8f0;
                    padding: 15px;
                    border-radius: 8px;
                    z-index: 9999;
                    font-family: monospace;
                    font-size: 11px;
                    border: 2px solid #4a5568;
                    min-width: 200px;
                ">
                    <div style="color: #90cdf4; font-weight: bold; margin-bottom: 10px;">🤖 NIGGA BOT</div>
                    <div>📚 Notes: <span id="notes-status" style="color: #f56565;">Not Loaded</span></div>
                    <div>🚀 Status: <span id="bot-status" style="color: #f56565;">Inactive</span></div>
                    <div>📝 Processed: <span id="processed-count">0</span></div>
                    <div>💡 Info: <span id="info-text">Load notes to start</span></div>
                </div>
            `;
            document.body.appendChild(panel);
            
            this.statusPanel = panel;
            this.updateStatus();
        }

        updateStatus() {
            if (!this.statusPanel) return;
            
            const notesStatus = this.statusPanel.querySelector('#notes-status');
            const botStatus = this.statusPanel.querySelector('#bot-status');
            const processedCount = this.statusPanel.querySelector('#processed-count');
            const infoText = this.statusPanel.querySelector('#info-text');
            
            if (notesStatus) {
                notesStatus.textContent = this.notesLoaded ? '✅ Loaded' : '❌ Not Loaded';
                notesStatus.style.color = this.notesLoaded ? '#68d391' : '#f56565';
            }
            
            if (botStatus) {
                botStatus.textContent = this.botActive ? '✅ Active' : '❌ Inactive';
                botStatus.style.color = this.botActive ? '#68d391' : '#f56565';
            }
            
            if (processedCount) {
                processedCount.textContent = this.processedQuestions.size;
            }
            
            if (infoText) {
                if (!this.notesLoaded) {
                    infoText.textContent = 'Load notes to start';
                    infoText.style.color = '#f56565';
                } else if (!this.botActive) {
                    infoText.textContent = 'Processing notes...';
                    infoText.style.color = '#f59e0b';
                } else {
                    infoText.textContent = 'Ready for questions';
                    infoText.style.color = '#68d391';
                }
            }
        }

        initialize() {
            this.initializeFileInput();
            this.showStatusPanel();
            this.startAutoMonitor();
            
            console.log('🚀 Notes-First Quiz Bot Ready!');
            console.log('💡 Click "Load Notes Files" to add your study notes');
            console.log('💡 Load a .txt file with "none" if you have no notes');
            console.log('💡 The bot will activate only after notes are loaded');
        }
    }

    // Initialize the notes-first bot
    const bot = new NotesFirstQuizBot();
    bot.initialize();

})();