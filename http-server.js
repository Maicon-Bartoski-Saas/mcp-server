import express from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar o servidor Express
const app = express();
const port = process.env.PORT || 8080;

// Middleware para processar JSON
app.use(express.json());

// Rota de verificação de saúde
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'MCP Server is running' });
});

// Rota principal para processar requisições MCP
app.post('/api/mcp', async (req, res) => {
  try {
    // Executar o processo MCP com a entrada do usuário
    const mcpProcess = spawn('node', [join(__dirname, 'build', 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Enviar a requisição para o processo
    if (req.body) {
      mcpProcess.stdin.write(JSON.stringify(req.body) + '\n');
      mcpProcess.stdin.end();
    }
    
    // Coletar a resposta
    let responseData = '';
    mcpProcess.stdout.on('data', (data) => {
      responseData += data.toString();
    });
    
    // Coletar erros
    let errorData = '';
    mcpProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error(`MCP stderr: ${data}`);
    });
    
    // Processar o resultado quando o processo terminar
    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`MCP process exited with code ${code}`);
        return res.status(500).json({ 
          error: 'MCP process failed', 
          details: errorData,
          code 
        });
      }
      
      try {
        // Tentar analisar a resposta como JSON
        const jsonResponse = JSON.parse(responseData);
        res.json(jsonResponse);
      } catch (parseError) {
        // Se não for JSON válido, enviar como texto
        res.send(responseData);
      }
    });
  } catch (error) {
    console.error('Error processing MCP request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rota para lidar com requisições não encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`MCP HTTP Server running on port ${port}`);
});