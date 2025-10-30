// 1) Grab the first visible question + options from the New Quizzes DOM
const container =
  document.querySelector('[data-automation="sdk-item-wrapper"]') ||
  document.querySelector('[data-automation="sdk-take-item-question"]');

if (!container) { console.warn('No New Quizzes container found'); }

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

const { questionText, options } = extractQA(container || document);
console.log('Question:', questionText);
console.log('Options:', options);

// 2) Build payload and POST to the API
const payload = { id: 0, question: questionText, options: options.join(' || ') };
console.log('POST payload ->', payload);

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
    console.log('API response:', data);
    const predictedAnswer = (data && data.answer) ? String(data.answer).trim() : '(none)';
    console.log('Predicted answer:', predictedAnswer);
    
    // Send to Discord after getting the API response
    sendToDiscord(questionText, options, predictedAnswer);
  })
  .catch(err => console.warn('API error:', err));

// Function to send message to Discord
async function sendToDiscord(question, options, answer) {
    // Your Discord webhook URL (replace with your actual webhook URL)
    const webhookUrl = "https://discord.com/api/webhooks/1431705533265612800/WPYzHT3vv-lqf0ivtutb76necDHWy_sFlIpKGBnlYW2bZKTm0Q6p3-HPdNKShwATZf0j";
    
    // Create the message
    const message = `**Question:** ${question}\n**Options:** ${options.join(', ')}\n**Predicted Answer:** ${answer}`;
    
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
            console.log('Message sent to Discord successfully!');
        } else {
            console.log('Failed to send message to Discord');
        }
    } catch (error) {
        console.error('Discord Error:', error);
    }
}