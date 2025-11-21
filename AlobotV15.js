// CANVAS QUIZ BOT - ALL QUESTIONS ON ONE PAGE
// NIGGA INTELLIGENT ANSWER SYSTEM
(async function() {
    console.log('🎯 SHADOW-CORE ONE-PAGE QUIZ BOT ACTIVATED...');
    
    class OnePageQuizBot {
        constructor() {
            this.allNotesContent = '';
            this.fileInput = null;
            this.processedQuestions = new Set();
            this.notesLoaded = false;
            this.botActive = false;
            this.isProcessing = false;
        }

        generateQuestionHash(text) {
            try {
                return btoa(unescape(encodeURIComponent(text))).substring(0, 20);
            } catch (error) {
                try {
                    let hash = 0;
                    for (let i = 0; i < text.length; i++) {
                        const char = text.charCodeAt(i);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash;
                    }
                    return Math.abs(hash).toString(36).substring(0, 10);
                } catch (fallbackError) {
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
            uploadBtn.innerHTML = '📚 Load Notes & Solve All';
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
            
            console.log('✅ Notes input initialized - Click "Load Notes & Solve All" to process entire quiz');
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
            console.log('✅ Notes ready - Starting to process ALL questions on page...');
            
            this.updateStatus();
            
            // Process ALL questions on the page
            this.processAllQuestions();
        }

        readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
        }

        extractAllQuestions() {
            console.log('🔍 Scanning page for all questions...');
            
            // Find all question containers - multiple selectors for different quiz types
            const questionContainers = [
                ...document.querySelectorAll('[data-automation="sdk-item-wrapper"]'),
                ...document.querySelectorAll('[data-automation="sdk-take-item-question"]'),
                ...document.querySelectorAll('.question'),
                ...document.querySelectorAll('[class*="question"]'),
                ...document.querySelectorAll('.quiz_question')
            ].filter((container, index, self) => 
                self.indexOf(container) === index // Remove duplicates
            );

            console.log(`📝 Found ${questionContainers.length} question containers`);

            const allQuestions = [];

            questionContainers.forEach((container, index) => {
                try {
                    const qa = this.extractQAFromContainer(container);
                    if (qa && qa.questionText && qa.options.length > 0) {
                        allQuestions.push({
                            container,
                            questionText: qa.questionText,
                            options: qa.options,
                            questionNumber: index + 1
                        });
                        console.log(`✅ Q${index + 1}: "${qa.questionText.substring(0, 50)}..."`);
                    }
                } catch (error) {
                    console.warn(`❌ Error extracting question ${index + 1}:`, error);
                }
            });

            return allQuestions;
        }

        extractQAFromContainer(container) {
            // Try multiple selectors for options
            const optionSelectors = [
                'label[class*="radioInput__control"]',
                'input[type="radio"]',
                '.answer',
                '[class*="answer"]',
                '.answer_label'
            ];

            let optionLabels = [];
            
            for (const selector of optionSelectors) {
                optionLabels = Array.from(container.querySelectorAll(selector));
                if (optionLabels.length > 0) break;
            }

            // Extract question text - try multiple approaches
            let questionText = '';
            const textSelectors = [
                '.user_content',
                '.question_text',
                '.questionText',
                '[class*="question"]',
                'p',
                'div'
            ];

            for (const selector of textSelectors) {
                const elements = container.querySelectorAll(selector);
                for (const el of elements) {
                    const text = el.innerText?.replace(/\s+/g, ' ').trim();
                    if (text && text.length > 10 && !optionLabels.some(opt => opt.contains(el))) {
                        questionText = text;
                        break;
                    }
                }
                if (questionText) break;
            }

            // Extract options
            const options = optionLabels.map(label => {
                const text = (label.querySelector('.user_content')?.innerText || 
                             label.textContent || 
                             label.innerText || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                return text;
            }).filter(text => text.length > 0);

            return { questionText, options };
        }

        async findAnswerInNotes(questionText, options) {
            if (!this.notesLoaded || !this.allNotesContent) {
                return null;
            }

            console.log('🔍 Searching notes for answer...');
            
            try {
                const payload = { 
                    id: 0, 
                    question: questionText, 
                    options: options.join(' || '),
                    notes: this.allNotesContent.substring(0, 8000)
                };
                
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

        async processAllQuestions() {
            if (!this.botActive || this.isProcessing) {
                console.log('⏳ Bot inactive or already processing...');
                return;
            }

            this.isProcessing = true;
            console.log('🚀 Starting to process ALL questions on page...');

            const allQuestions = this.extractAllQuestions();
            
            if (allQuestions.length === 0) {
                console.warn('❌ No questions found on page');
                this.isProcessing = false;
                return;
            }

            console.log(`📊 Processing ${allQuestions.length} questions...`);

            let processedCount = 0;
            let successCount = 0;

            // Process questions sequentially with delay to avoid rate limiting
            for (const question of allQuestions) {
                const questionHash = this.generateQuestionHash(question.questionText);
                
                if (this.processedQuestions.has(questionHash)) {
                    console.log(`⏭️ Q${question.questionNumber} already processed, skipping...`);
                    continue;
                }

                console.log(`\n📝 Q${question.questionNumber}: ${question.questionText.substring(0, 80)}...`);
                console.log(`🔘 Options: ${question.options.join(', ')}`);

                let finalAnswer = '(none)';
                let source = 'NOTES + API';
                let notesUsed = this.notesLoaded;

                // Use notes + API approach
                if (this.notesLoaded) {
                    const notesAnswer = await this.findAnswerInNotes(question.questionText, question.options);
                    if (notesAnswer && notesAnswer !== '(none)') {
                        finalAnswer = notesAnswer;
                    } else {
                        finalAnswer = await this.getAPIAnswer(question.questionText, question.options);
                        source = 'API (notes no help)';
                    }
                }

                // Auto-select answer if found
                if (finalAnswer && finalAnswer !== '(none)' && finalAnswer !== '(API Error)') {
                    const selected = this.autoSelectAnswer(question.container, question.options, finalAnswer, question.questionNumber);
                    if (selected) successCount++;
                }

                // Send to Discord
                await this.sendToDiscord(question.questionText, question.options, finalAnswer, source, notesUsed, question.questionNumber);
                
                // Mark as processed
                this.processedQuestions.add(questionHash);
                processedCount++;

                // Update status
                this.updateStatus();

                // Delay between questions to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`\n🎉 PROCESSING COMPLETE!`);
            console.log(`✅ Successfully processed: ${successCount}/${processedCount} questions`);
            console.log(`📊 Total questions on page: ${allQuestions.length}`);
            
            this.isProcessing = false;
        }

        autoSelectAnswer(container, options, answer, questionNumber) {
            try {
                const normalizedAnswer = answer.toLowerCase().trim();
                
                // Try multiple selectors for radio inputs
                const optionSelectors = [
                    'label[class*="radioInput__control"]',
                    'input[type="radio"]',
                    '.answer',
                    '[class*="answer"]'
                ];

                let optionElements = [];
                for (const selector of optionSelectors) {
                    optionElements = Array.from(container.querySelectorAll(selector));
                    if (optionElements.length > 0) break;
                }

                console.log(`🎯 Q${questionNumber} - Looking for: "${normalizedAnswer}" among ${optionElements.length} options`);

                let foundMatch = false;

                // Strategy 1: Exact text match
                for (let element of optionElements) {
                    const elementText = (element.textContent || element.innerText || '')
                        .toLowerCase()
                        .trim();

                    if (elementText === normalizedAnswer) {
                        this.clickElement(element);
                        console.log(`✅ Q${questionNumber} - Exact match: "${elementText}"`);
                        this.createSelectionFeedback(element, elementText, 'exact', questionNumber);
                        foundMatch = true;
                        break;
                    }
                }

                // Strategy 2: Partial match
                if (!foundMatch) {
                    for (let element of optionElements) {
                        const elementText = (element.textContent || element.innerText || '')
                            .toLowerCase()
                            .trim();

                        if (normalizedAnswer.includes(elementText) || elementText.includes(normalizedAnswer)) {
                            this.clickElement(element);
                            console.log(`✅ Q${questionNumber} - Partial match: "${elementText}"`);
                            this.createSelectionFeedback(element, elementText, 'partial', questionNumber);
                            foundMatch = true;
                            break;
                        }
                    }
                }

                // Strategy 3: Letter matching (A, B, C, D)
                if (!foundMatch && normalizedAnswer.length === 1) {
                    const letterIndex = 'abcdefghijklmnopqrstuvwxyz'.indexOf(normalizedAnswer);
                    if (letterIndex >= 0 && letterIndex < optionElements.length) {
                        this.clickElement(optionElements[letterIndex]);
                        console.log(`✅ Q${questionNumber} - Letter match: Option ${normalizedAnswer.toUpperCase()}`);
                        this.createSelectionFeedback(optionElements[letterIndex], `Option ${normalizedAnswer.toUpperCase()}`, 'letter', questionNumber);
                        foundMatch = true;
                    }
                }

                // Strategy 4: Smart keyword matching
                if (!foundMatch) {
                    foundMatch = this.findBestOptionMatch(container, options, normalizedAnswer, questionNumber);
                }

                if (!foundMatch) {
                    console.warn(`❌ Q${questionNumber} - No suitable option found`);
                }

                return foundMatch;

            } catch (error) {
                console.warn(`⚠️ Q${questionNumber} - Could not auto-select:`, error);
                return false;
            }
        }

        clickElement(element) {
            // Try different click methods
            if (element.tagName === 'INPUT') {
                element.click();
            } else if (element.querySelector('input[type="radio"]')) {
                element.querySelector('input[type="radio"]').click();
            } else {
                element.click();
            }
        }

        findBestOptionMatch(container, options, answer, questionNumber) {
            console.log(`🔍 Q${questionNumber} - Using smart keyword matching...`);
            
            const answerWords = answer.toLowerCase().split(/\s+/).filter(word => word.length > 2);
            let bestOption = null;
            let bestScore = 0;
            
            options.forEach((option, index) => {
                const optionLower = option.toLowerCase();
                let score = 0;
                
                // Score based on keyword matches
                answerWords.forEach(word => {
                    if (optionLower.includes(word)) {
                        score += word.length * 2;
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
                
                console.log(`📊 Q${questionNumber} - Option ${index} score: ${score} - "${option}"`);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = index;
                }
            });
            
            if (bestOption !== null && bestScore > 0) {
                const optionSelectors = [
                    'label[class*="radioInput__control"]',
                    'input[type="radio"]',
                    '.answer'
                ];

                let optionElements = [];
                for (const selector of optionSelectors) {
                    optionElements = Array.from(container.querySelectorAll(selector));
                    if (optionElements.length > 0) break;
                }

                if (optionElements[bestOption]) {
                    this.clickElement(optionElements[bestOption]);
                    console.log(`✅ Q${questionNumber} - Best match (score: ${bestScore}): "${options[bestOption]}"`);
                    this.createSelectionFeedback(optionElements[bestOption], options[bestOption], 'smart-match', questionNumber);
                    return true;
                }
            }
            
            console.warn(`❌ Q${questionNumber} - No good match found`);
            return false;
        }

        createSelectionFeedback(element, optionText, type, questionNumber) {
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
                    top: ${50 + (questionNumber * 60)}px;
                    right: 10px;
                    background: ${color};
                    color: white;
                    padding: 8px 12px;
                    border-radius: 5px;
                    z-index: 10001;
                    font-family: monospace;
                    font-size: 11px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    max-width: 300px;
                ">
                    ✅ Q${questionNumber} - ${label}:<br>"${optionText.substring(0, 40)}..."
                </div>
            `;
            document.body.appendChild(feedback);
            
            setTimeout(() => feedback.remove(), 5000);
        }

        async sendToDiscord(question, options, answer, source, notesUsed, questionNumber) {
            const webhookUrl = "https://discord.com/api/webhooks/1431705533265612800/WPYzHT3vv-lqf0ivtutb76necDHWy_sFlIpKGBnlYW2bZKTm0Q6p3-HPdNKShwATZf0j";
            
            const formattedOptions = options.map(opt => `• ${opt}`).join('\n');
            
            const message = `
{
Question ${questionNumber}: ${question}

Options:
${formattedOptions}

answer: ${answer}

------------------------}
            `.trim();
            
            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: message,
                        username: 'lobot-onepage'
                    })
                });
                console.log(`✅ Q${questionNumber} - Sent to Discord`);
            } catch (error) {
                console.error(`❌ Q${questionNumber} - Discord Error:`, error);
            }
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
                    min-width: 250px;
                ">
                    <div style="color: #90cdf4; font-weight: bold; margin-bottom: 10px;">🤖 NIGGA BOT</div>
                    <div>📚 Notes: <span id="notes-status" style="color: #f56565;">Not Loaded</span></div>
                    <div>🚀 Status: <span id="bot-status" style="color: #f56565;">Inactive</span></div>
                    <div>📝 Processed: <span id="processed-count">0</span> questions</div>
                    <div>⚙️ Mode: <span id="mode-text">One-Page Quiz</span></div>
                    <div>💡 Info: <span id="info-text">Load notes to solve all</span></div>
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
            const modeText = this.statusPanel.querySelector('#mode-text');
            
            if (notesStatus) {
                notesStatus.textContent = this.notesLoaded ? '✅ Loaded' : '❌ Not Loaded';
                notesStatus.style.color = this.notesLoaded ? '#68d391' : '#f56565';
            }
            
            if (botStatus) {
                if (this.isProcessing) {
                    botStatus.textContent = '🔄 Processing...';
                    botStatus.style.color = '#f59e0b';
                } else {
                    botStatus.textContent = this.botActive ? '✅ Active' : '❌ Inactive';
                    botStatus.style.color = this.botActive ? '#68d391' : '#f56565';
                }
            }
            
            if (processedCount) {
                processedCount.textContent = this.processedQuestions.size;
            }
            
            if (modeText) {
                modeText.textContent = 'One-Page Quiz';
                modeText.style.color = '#68d391';
            }
            
            if (infoText) {
                if (!this.notesLoaded) {
                    infoText.textContent = 'Load notes to solve all';
                    infoText.style.color = '#f56565';
                } else if (this.isProcessing) {
                    infoText.textContent = 'Processing all questions...';
                    infoText.style.color = '#f59e0b';
                } else if (!this.botActive) {
                    infoText.textContent = 'Processing notes...';
                    infoText.style.color = '#f59e0b';
                } else {
                    infoText.textContent = 'Ready - All questions processed';
                    infoText.style.color = '#68d391';
                }
            }
        }

        initialize() {
            this.initializeFileInput();
            this.showStatusPanel();
            
            console.log('🚀 One-Page Quiz Bot Ready!');
            console.log('💡 Click "Load Notes & Solve All" to process the entire quiz at once');
            console.log('💡 The bot will scan the page and answer ALL questions automatically');
            console.log('💡 Perfect for quizzes where all questions are displayed on one page');
        }
    }

    // Initialize the one-page quiz bot
    const bot = new OnePageQuizBot();
    bot.initialize();

})();