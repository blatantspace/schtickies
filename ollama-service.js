const fetch = require('node-fetch');

class OllamaService {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:11434';
        this.summaryInterval = null;
        this.connectionStatus = 'checking';
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async checkConnection() {
        try {
            console.log('Checking OLAMMA connection...');
            const response = await fetch(`${this.baseUrl}/api/tags`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('OLAMMA API error:', { status: response.status, body: errorText });
                throw new Error(`OLAMMA API error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Available models:', data.models);
            
            if (!data.models || data.models.length === 0) {
                console.error('No models available in OLAMMA');
                throw new Error('No models available in OLAMMA');
            }
            
            this.connectionStatus = 'connected';
            this.retryCount = 0;
            console.log('Successfully connected to OLAMMA');
            return true;
        } catch (error) {
            console.error('OLAMMA connection error:', error);
            this.retryCount++;
            
            if (this.retryCount <= this.maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
                console.log(`Retrying connection in ${delay/1000}s (${this.retryCount}/${this.maxRetries})...`);
                this.connectionStatus = 'checking';
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.checkConnection();
            } else {
                console.error('Max retries reached. OLAMMA connection failed.');
                this.connectionStatus = 'disconnected';
                return false;
            }
        }
    }

    async generateSummary(content, model, directive) {
        if (!content || !content.trim()) {
            console.log('No content to summarize');
            return 'No content to summarize yet. Start typing in your note to see a summary here.';
        }

        try {
            console.log('Generating summary with:', { model, directive, contentLength: content.length });
            const prompt = `${directive}\n\n${content}`;
            
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OLAMMA API error:', { status: response.status, body: errorText });
                throw new Error(`OLAMMA API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('OLAMMA response:', data);
            
            if (!data || !data.response) {
                console.error('Invalid OLAMMA response:', data);
                throw new Error('Invalid response from OLAMMA - no summary generated');
            }
            
            return data.response;
        } catch (error) {
            console.error('Error generating summary:', error);
            return `Error generating summary: ${error.message}. Please check your OLAMMA setup and try again.`;
        }
    }

    generateSummaryOnce(content, model, directive, callback) {
        // Clear any existing interval (for backwards compatibility)
        if (this.summaryInterval) {
            clearInterval(this.summaryInterval);
            this.summaryInterval = null;
        }

        // Generate summary once
        this.generateSummary(content, model, directive)
            .then(callback)
            .catch(error => {
                console.error('Error generating summary:', error);
                callback('Error generating summary. Please check your OLAMMA setup.');
            });
    }

    // Keep this for backwards compatibility
    startSummaryInterval(content, model, directive, callback) {
        this.generateSummaryOnce(content, model, directive, callback);
    }

    stopSummaryInterval() {
        if (this.summaryInterval) {
            clearInterval(this.summaryInterval);
            this.summaryInterval = null;
        }
    }
}

module.exports = new OllamaService(); 