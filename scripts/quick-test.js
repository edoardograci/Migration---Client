// Quick test for Ollama API
const body = JSON.stringify({
    model: 'qwen2.5:7b-instruct',
    prompt: 'Return a valid JSON object with key "status" and value "ok"',
    stream: false,
    format: 'json',
    options: { temperature: 0.1, num_predict: 50 }
});

fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
})
    .then(r => r.json())
    .then(d => {
        console.log('AI Response:', d.response);
        console.log('Done:', d.done);
        console.log('Total duration:', Math.round(d.total_duration / 1000000), 'ms');
    })
    .catch(e => console.log('Error:', e.message));
