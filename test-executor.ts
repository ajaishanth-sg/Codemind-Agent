async function test() {
    const apiUrl = process.env.API_URL || "http://127.0.0.1:8000/v1/chat/completions";
    const apiKey = process.env.API_KEY || "your-api-key";
    
    const body = {
        model: "qwen3-coder:30b",
        messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: "What is 2+2?" }],
        temperature: 0.2
    };

    try {
        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
