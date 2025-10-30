// 1) Find ALL visible question containers from the New Quizzes DOM
const questionContainers = document.querySelectorAll([
    '[data-automation="sdk-item-wrapper"]',
    '[data-automation="sdk-take-item-question"]',
    '.question',
    '[class*="questionContainer"]'
].join(','));

if (!questionContainers.length) { 
    console.warn('No New Quizzes question containers found'); 
}

console.log(`Found ${questionContainers.length} questions`);

// Your existing extraction function
function extractQA(root) {
    // option labels in New Quizzes have a build-generated class containing "radioInput__control"
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
    const options = optionLabels.map(l => (l.querySelector('.user_content')?.innerText || l.innerText || '')
        .replace(/\s+/g,' ')
        .trim()
    );
    return { questionText, options };
}

// Process ALL questions
const allQuestionsData = Array.from(questionContainers).map((container, index) => {
    const { questionText, options } = extractQA(container);
    console.log(`Question ${index + 1}:`, questionText);
    console.log(`Options ${index + 1}:`, options);
    
    return {
        id: index,
        question: questionText,
        options: options,
        optionsString: options.join(' || ')
    };
});

console.log('All questions data:', allQuestionsData);

// 2) Send ALL questions to the API and then to Discord
allQuestionsData.forEach((questionData, index) => {
    const payload = { 
        id: questionData.id, 
        question: questionData.question, 
        options: questionData.optionsString 
    };
    
    console.log(`POST payload for question ${index + 1} ->`, payload);

    fetch('https://canvasquiz-new.uc.r.appspot.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(r => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(data => {
            console.log(`API response for question ${index + 1}:`, data);
            const predictedAnswer = (data && data.answer) ? String(data.answer).trim() : '(none)';
            console.log(`Predicted answer for question ${index + 1}:`, predictedAnswer);
            
            // Send to Discord after getting the API response
            sendToDiscord(questionData.question, questionData.options, predictedAnswer, index + 1);
        })
        .catch(err => console.warn(`API error for question ${index + 1}:`, err));
});

// Modified function to send message to Discord with spacing
async function sendToDiscord(question, options, answer, questionNumber) {
    // Your Discord webhook URL (replace with your actual webhook URL)
    const webhookUrl = "https://discord.com/api/webhooks/1431705533265612800/WPYzHT3vv-lqf0ivtutb76necDHWy_sFlIpKGBnlYW2bZKTm0Q6p3-HPdNKShwATZf0j";
    
    // Create the message with question number and spacing
    const message = `**Question ${questionNumber}:** ${question}\n**Options:** ${options.join(', ')}\n**Answer:** ${answer}\n\n─────────────────────\n`;
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: message,
                username: 'lobot'
            })
        });

        if (response.ok) {
            console.log(`Message for question ${questionNumber} sent to Discord successfully!`);
        } else {
            console.log(`Failed to send message for question ${number} to Discord`);
        }
    } catch (error) {
        console.error(`Discord Error for question ${questionNumber}:`, error);
    }
}