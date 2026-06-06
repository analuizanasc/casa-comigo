// Configura variáveis de ambiente ANTES de qualquer require do app ou banco
// Este arquivo deve ser o primeiro a ser carregado em toda a suíte de testes
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = './data/casa-comigo-test.db';
process.env.JWT_SECRET = 'chave-secreta-para-testes-unitarios';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '0';
