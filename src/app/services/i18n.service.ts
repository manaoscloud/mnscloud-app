import { computed, Injectable, signal } from '@angular/core';
import { AUTO_EN_TO_ES, AUTO_EN_TO_PT } from './i18n.auto';

export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES';
export type LanguageOptionCode = AppLanguage | 'auto';
type AppLanguageMode = 'auto' | 'manual';

export const I18N_STORAGE_KEY = 'mc_language';
const I18N_MODE_STORAGE_KEY = 'mc_language_mode';

const MENU_TRANSLATIONS_PT: Record<string, string> = {
  Dashboard: 'Painel',
  System: 'Sistema',
  Financial: 'Financeiro',
  'Payment Gateways': 'Gateways de Pagamento',
  Hosting: 'Hospedagem',
  'SMTP Delivery': 'Entrega SMTP',
  Storage: 'Armazenamento',
  ISP: 'ISP',
  'Radius Server': 'Servidor Radius',
  VoIP: 'VoIP',
  Softswitch: 'Softswitch',
  Monitoring: 'Monitoramento',
  User: 'Usuário',
  'My Profile': 'Meu Perfil',
  ERP: 'ERP',
  Registration: 'Cadastro',
  Companies: 'Empresas',
  Customer: 'Cliente',
  Supplier: 'Fornecedor',
  Carrier: 'Transportadora',
  Reseller: 'Revendedor',
  Complex: 'Condomínio',
  'Human Resources': 'Recursos Humanos',
  Employees: 'Funcionários',
  Departments: 'Departamentos',
  Positions: 'Cargos',
  Accounts: 'Contas',
  Payables: 'Contas a Pagar',
  Receivables: 'Contas a Receber',
  Payment: 'Pagamento',
  Methods: 'Métodos',
  Gateway: 'Gateway',
  Invoicing: 'Faturamento',
  Boletos: 'Boletos',
  Invoices: 'Faturas',
  Contracts: 'Contratos',
  'Due Days': 'Dias de Vencimento',
  CRM: 'CRM',
  Leads: 'Leads',
  Opportunities: 'Oportunidades',
  Pipeline: 'Pipeline',
  Support: 'Suporte',
  Tickets: 'Chamados',
  Registry: 'Cadastro',
  Channels: 'Canais',
  Teams: 'Equipes',
  'Chat Channels': 'Canais de Chat',
  Attendance: 'Atendimento',
  POP: 'POP',
  NAS: 'NAS',
  OLT: 'OLT',
  'PPPoE Client': 'Cliente PPPoE',
  Vendor: 'Fornecedor',
  Model: 'Modelo',
  GeoMap: 'GeoMap',
  Map: 'Mapa',
  Projects: 'Projetos',
  Assets: 'Ativos',
  Types: 'Tipos',
  Models: 'Modelos',
  FTTH: 'FTTH',
  Viability: 'Viabilidade',
  Capacity: 'Capacidade',
  Domain: 'Domínio',
  Site: 'Site',
  'E-mail': 'E-mail',
  Operator: 'Operadora',
  DID: 'DID',
  Portability: 'Portabilidade',
  Sale: 'Vendas',
  Stock: 'Estoque',
  Type: 'Tipo',
  'Unit of Measure': 'Unidade de Medida',
  Brand: 'Marca',
  Category: 'Categoria',
  Product: 'Produto',
  Quotation: 'Orçamento',
  Settings: 'Configurações',
  General: 'Geral',
  Themes: 'Temas',
  Tenants: 'Tenants',
};

const MENU_TRANSLATIONS_ES: Record<string, string> = {
  Dashboard: 'Panel',
  System: 'Sistema',
  Financial: 'Financiero',
  'Payment Gateways': 'Pasarelas de Pago',
  Hosting: 'Hosting',
  'SMTP Delivery': 'Entrega SMTP',
  Storage: 'Almacenamiento',
  ISP: 'ISP',
  'Radius Server': 'Servidor Radius',
  VoIP: 'VoIP',
  Softswitch: 'Softswitch',
  Monitoring: 'Monitoreo',
  User: 'Usuario',
  'My Profile': 'Mi Perfil',
  ERP: 'ERP',
  Registration: 'Registro',
  Companies: 'Empresas',
  Customer: 'Cliente',
  Supplier: 'Proveedor',
  Carrier: 'Transportista',
  Reseller: 'Revendedor',
  Complex: 'Complejo',
  'Human Resources': 'Recursos Humanos',
  Employees: 'Empleados',
  Departments: 'Departamentos',
  Positions: 'Cargos',
  Accounts: 'Cuentas',
  Payables: 'Cuentas por Pagar',
  Receivables: 'Cuentas por Cobrar',
  Payment: 'Pago',
  Methods: 'Métodos',
  Gateway: 'Pasarela',
  Invoicing: 'Facturación',
  Boletos: 'Boletos',
  Invoices: 'Facturas',
  Contracts: 'Contratos',
  'Due Days': 'Días de Vencimiento',
  CRM: 'CRM',
  Leads: 'Leads',
  Opportunities: 'Oportunidades',
  Pipeline: 'Pipeline',
  Support: 'Soporte',
  Tickets: 'Tickets',
  Registry: 'Registro',
  Channels: 'Canales',
  Teams: 'Equipos',
  'Chat Channels': 'Canales de Chat',
  Attendance: 'Atención',
  POP: 'POP',
  NAS: 'NAS',
  OLT: 'OLT',
  'PPPoE Client': 'Cliente PPPoE',
  Vendor: 'Proveedor',
  Model: 'Modelo',
  GeoMap: 'GeoMap',
  Map: 'Mapa',
  Projects: 'Proyectos',
  Assets: 'Activos',
  Types: 'Tipos',
  Models: 'Modelos',
  FTTH: 'FTTH',
  Viability: 'Viabilidad',
  Capacity: 'Capacidad',
  Domain: 'Dominio',
  Site: 'Sitio',
  'E-mail': 'E-mail',
  Operator: 'Operador',
  DID: 'DID',
  Portability: 'Portabilidad',
  Sale: 'Ventas',
  Stock: 'Inventario',
  Type: 'Tipo',
  'Unit of Measure': 'Unidad de Medida',
  Brand: 'Marca',
  Category: 'Categoría',
  Product: 'Producto',
  Quotation: 'Cotización',
  Settings: 'Configuración',
  General: 'General',
  Themes: 'Temas',
  Tenants: 'Tenants',
};

const COMMON_EN_TO_PT_MANUAL: Record<string, string> = {
  Tenant: 'Ambiente',
  Tenants: 'Ambientes',
  'My Tenants': 'Meus Ambientes',
  'Tenant Members': 'Membros do Ambiente',
  'Tenant Invitations': 'Convites do Ambiente',
  'Assign users with tenant access to this team.':
    'Atribua usuários com acesso ao ambiente para esta equipe.',
  'Automatic (tenant default, fallback to master default)':
    'Automático (padrão do ambiente, fallback para padrão master)',
  'Register and track VPS instances for your tenant.':
    'Cadastre e acompanhe instâncias VPS do seu ambiente.',
  'Radius Server': 'Servidor RADIUS',
  'Radius Core': 'Core RADIUS',
  'Manage PPPoE users authenticated by RADIUS.': 'Gerencie usuários PPPoE autenticados via RADIUS.',
  'Define the RADIUS endpoint and default behavior.':
    'Defina o endpoint RADIUS e o comportamento padrão.',
  'Radius (m)': 'Raio (m)',
  Bucket: 'Bucket',
  Attendance: 'Atendimento',
  'Loading attendance queue...': 'Carregando fila de atendimento...',
  Amount: 'Valor',
  Alias: 'Apelido',
  'Back to Sign In': 'Voltar para Entrar',
  'Billing address': 'Endereço de cobrança',
  'Billing Address': 'Endereço de cobrança',
  'Billing day': 'Dia de cobrança',
  'Billing complex': 'Condomínio de cobrança',
  'Bind primary domain and www alias.': 'Vincule o domínio principal e o alias www.',
  'Connect, disconnect and trace the FTTH chain.': 'Conecte, desconecte e rastreie a cadeia FTTH.',
  'Create and maintain GeoMap projects.': 'Crie e mantenha projetos do GeoMap.',
  'Define reusable types for the GeoMap asset registry and map markers.':
    'Defina tipos reutilizáveis para o cadastro de ativos e marcadores do GeoMap.',
  'GeoMap Capacity': 'GeoMap Capacidade',
  'GeoMap FTTH': 'GeoMap FTTH',
  'GeoMap Projects': 'GeoMap Projetos',
  'GeoMap Viability': 'GeoMap Viabilidade',
  'GeoMap Map': 'GeoMap Mapa',
  'GeoMap Asset Models': 'GeoMap Modelos de Ativo',
  'GeoMap Asset Types': 'GeoMap Tipos de Ativo',
  'Manage reusable asset types, labels, and default colors for GeoMap assets.':
    'Gerencie tipos de ativos, rótulos e cores padrão no GeoMap.',
  'Manage vendor models linked to GeoMap asset types.':
    'Gerencie modelos de fornecedor vinculados aos tipos de ativo do GeoMap.',
  'Register vendor models linked to GeoMap asset types.':
    'Cadastre modelos de fornecedor vinculados aos tipos de ativo do GeoMap.',
  'Point of Presence catalog for your ISP network.':
    'Catálogo de pontos de presença da sua rede ISP.',
  'Search due day rule': 'Buscar regra de vencimento',
  'Search Softswitch accounts': 'Buscar contas de Softswitch',
  'Name, due day, billing day, status': 'Nome, dia de vencimento, dia de cobrança, status',
  'Name, alias, document, city': 'Nome, apelido, documento, cidade',
  'e.g. FTTH Zone North': 'ex.: Zona FTTH Norte',
  'No VPS instances yet': 'Ainda não há instâncias VPS',
  'Configure due day, billing day and closed month rules.':
    'Configure regras de dia de vencimento, dia de cobrança e mês de fechamento.',
  'Manage contract lifecycle and billing context.':
    'Gerencie o ciclo de vida dos contratos e o contexto de cobrança.',
  'Create your first VPS provider to enable provisioning.':
    'Crie seu primeiro provedor VPS para habilitar o provisionamento.',
  'Create your first VPS entry to start tracking infrastructure.':
    'Crie seu primeiro registro VPS para começar a acompanhar a infraestrutura.',
  Save: 'Salvar',
  save: 'salvar',
  Cancel: 'Cancelar',
  Close: 'Fechar',
  Clear: 'Limpar',
  New: 'Novo',
  Apply: 'Aplicar',
  'Delete selected': 'Excluir selecionados',
  'Cancel selected': 'Cancelar selecionados',
  selected: 'selecionado(s)',
  Billing: 'Faturamento',
  'Billing Control': 'Controle de faturamento',
  'Prepaid balance, service catalog, subscriptions and ledger.':
    'Saldo pré-pago, catálogo de serviços, assinaturas e extrato.',
  'Global products, price book, subscriptions and prepaid credit operations.':
    'Produtos globais, tabela de preços, assinaturas e operações de crédito pré-pago.',
  'Active products': 'Produtos ativos',
  'Active prices': 'Preços ativos',
  'Active subscriptions': 'Assinaturas ativas',
  'Available catalog': 'Catálogo disponível',
  'Ledger entries': 'Lançamentos do extrato',
  'Products and price options': 'Produtos e opções de preço',
  'Financial movements': 'Movimentos financeiros',
  'No wallet': 'Sem carteira',
  'Add prepaid credit before contracting paid services.':
    'Adicione crédito pré-pago antes de contratar serviços pagos.',
  'Add credit': 'Adicionar crédito',
  Wallets: 'Carteiras',
  'Wallet operations': 'Operações de carteira',
  'Apply audited prepaid credits to tenant wallets.':
    'Aplique créditos pré-pagos auditados nas carteiras dos ambientes.',
  Catalog: 'Catálogo',
  Subscriptions: 'Assinaturas',
  Ledger: 'Extrato',
  'Search products': 'Buscar produtos',
  'Search prices': 'Buscar preços',
  'Search subscriptions': 'Buscar assinaturas',
  'Search products or resources': 'Buscar produtos ou recursos',
  'Search ledger': 'Buscar extrato',
  'Subscription status': 'Status da assinatura',
  'Pending payment': 'Pagamento pendente',
  Mode: 'Modo',
  'Unit price': 'Preço unitário',
  Setup: 'Instalação',
  Subscribe: 'Assinar',
  Resource: 'Recurso',
  Qty: 'Qtd',
  Date: 'Data',
  Direction: 'Direção',
  Balance: 'Saldo',
  Reason: 'Motivo',
  'No products available.': 'Nenhum produto disponível.',
  'No products found.': 'Nenhum produto encontrado.',
  'No prices found.': 'Nenhum preço encontrado.',
  'No subscriptions found.': 'Nenhuma assinatura encontrada.',
  'No ledger entries found.': 'Nenhum lançamento encontrado.',
  All: 'Todos',
  None: 'Nenhum',
  Search: 'Buscar',
  Refresh: 'Atualizar',
  Add: 'Adicionar',
  add: 'adicionar',
  edit: 'editar',
  delete: 'excluir',
  refresh: 'atualizar',
  close: 'fechar',
  Edit: 'Editar',
  Delete: 'Excluir',
  Active: 'Ativo',
  Inactive: 'Inativo',
  Status: 'Status',
  Name: 'Nome',
  Description: 'Descrição',
  Type: 'Tipo',
  Email: 'E-mail',
  Phone: 'Telefone',
  Number: 'Número',
  Notes: 'Observações',
  Actions: 'Ações',
  Default: 'Padrão',
  Customer: 'Cliente',
  Supplier: 'Fornecedor',
  Document: 'Documento',
  Due: 'Vencimento',
  'Due date': 'Data de vencimento',
  'Due Date': 'Data de Vencimento',
  City: 'Cidade',
  POP: 'POP',
  NAS: 'NAS',
  OLT: 'OLT',
  DID: 'DID',
  API: 'API',
  Host: 'Host',
  IP: 'IP',
  Longitude: 'Longitude',
  Latitude: 'Latitude',
  State: 'Estado',
  Country: 'País',
  Street: 'Rua',
  District: 'Bairro',
  Zip: 'CEP',
  Region: 'Região',
  Company: 'Empresa',
  Provider: 'Provedor',
  Title: 'Título',
  Code: 'Código',
  Password: 'Senha',
  'New Password': 'Nova Senha',
  'First Name': 'Nome',
  'Last Name': 'Sobrenome',
  Person: 'Pessoa',
  Nick: 'Apelido',
  Website: 'Website',
  Username: 'Usuário',
  Subject: 'Assunto',
  Priority: 'Prioridade',
  Stage: 'Etapa',
  Result: 'Resultado',
  Value: 'Valor',
  Plan: 'Plano',
  'Size / Plan': 'Tamanho / Plano',
  Method: 'Método',
  Channel: 'Canal',
  Operator: 'Operadora',
  Vendor: 'Fornecedor',
  Model: 'Modelo',
  'Vendor Model': 'Modelo do Fornecedor',
  Price: 'Preço',
  Product: 'Produto',
  Category: 'Categoria',
  Brand: 'Marca',
  Domain: 'Domínio',
  Role: 'Perfil',
  User: 'Usuário',
  Unit: 'Unidade',
  Discount: 'Desconto',
  Total: 'Total',
  Sent: 'Enviado',
  Draft: 'Rascunho',
  Rejected: 'Rejeitado',
  Primary: 'Principal',
  'Issue date': 'Data de emissão',
  'Start date': 'Data de início',
  'End date': 'Data de término',
  'Valid Until': 'Válido até',
  'Unit Price': 'Preço unitário',
  'Document number': 'Número do documento',
  'Display name': 'Nome de exibição',
  'No provider accounts yet': 'Ainda não há contas de provedor',
  'Access level': 'Nível de acesso',
  'Event Type': 'Tipo de evento',
  'Access token': 'Token de acesso',
  'Access Key ID': 'ID da chave de acesso',
  'Secret Access Key': 'Chave secreta de acesso',
  'API Key': 'Chave de API',
  'API Secret': 'Segredo da API',
  'Base URL': 'URL base',
  'Unt. Code': 'Código UNT',
  Verify: 'Verificar',
  'Verify token': 'Verificar token',
  Disconnect: 'Desconectar',
  'Loading...': 'Carregando...',
  'Sign in': 'Entrar',
  'Sign In': 'Entrar',
  'Recover Password': 'Recuperar Senha',
  'Send Instructions': 'Enviar instruções',
  'Access your mnscloud account': 'Acesse sua conta mnscloud',
  'Forgot your password?': 'Esqueceu sua senha?',
  'Create one': 'Criar uma',
  "Don't have an account?": 'Não tem uma conta?',
  'Welcome Back': 'Bem-vindo de volta',
  'My Profile': 'Meu Perfil',
  Logout: 'Sair',
  Settings: 'Configurações',
  Offline: 'Offline',
  'No environments': 'Sem ambientes',
  'No environment': 'Sem ambiente',
  'Set default': 'Definir padrão',
  'All rights reserved.': 'Todos os direitos reservados.',
  'Good morning': 'Bom dia',
  'Good afternoon': 'Boa tarde',
  'Good evening': 'Boa noite',
  'You must enter a value': 'Você deve informar um valor',
  'Not a valid email': 'E-mail inválido',
  'Invalid credentials.': 'Credenciais inválidas.',
  'Invalid API response': 'Resposta inválida da API',
  'Welcome back!': 'Bem-vindo de volta!',
  'Search menu...': 'Buscar no menu...',
};

const COMMON_EN_TO_ES_MANUAL: Record<string, string> = {
  Tenant: 'Entorno',
  Tenants: 'Entornos',
  'My Tenants': 'Mis Entornos',
  'Tenant Members': 'Miembros del Entorno',
  'Tenant Invitations': 'Invitaciones del Entorno',
  'Assign users with tenant access to this team.':
    'Asigne usuarios con acceso al entorno a este equipo.',
  'Automatic (tenant default, fallback to master default)':
    'Automático (predeterminado del entorno, con fallback al predeterminado master)',
  'Register and track VPS instances for your tenant.':
    'Registre y controle instancias VPS de su entorno.',
  'Radius Server': 'Servidor RADIUS',
  'Radius Core': 'Core RADIUS',
  'Define the RADIUS endpoint and default behavior.':
    'Defina el endpoint RADIUS y el comportamiento predeterminado.',
  'Manage PPPoE users authenticated by RADIUS.':
    'Administre usuarios PPPoE autenticados por RADIUS.',
  'Radius (m)': 'Radio (m)',
  Bucket: 'Bucket',
  Attendance: 'Atención',
  'Loading attendance queue...': 'Cargando cola de atención...',
  Alias: 'Alias',
  Amount: 'Importe',
  'Back to Sign In': 'Volver a Iniciar sesión',
  'Billing address': 'Dirección de facturación',
  'Billing Address': 'Dirección de facturación',
  'Billing day': 'Día de facturación',
  'Billing complex': 'Condominio de facturación',
  'Bind primary domain and www alias.': 'Vincule el dominio principal y el alias www.',
  'Connect, disconnect and trace the FTTH chain.': 'Conecte, desconecte y rastree la cadena FTTH.',
  'Create and maintain GeoMap projects.': 'Cree y mantenga proyectos de GeoMap.',
  'Define reusable types for the GeoMap asset registry and map markers.':
    'Defina tipos reutilizables para el registro de activos y marcadores de GeoMap.',
  'GeoMap Capacity': 'GeoMap Capacidad',
  'GeoMap FTTH': 'GeoMap FTTH',
  'GeoMap Projects': 'GeoMap Proyectos',
  'GeoMap Viability': 'GeoMap Viabilidad',
  'GeoMap Map': 'GeoMap Mapa',
  'GeoMap Asset Models': 'GeoMap Modelos de Activo',
  'GeoMap Asset Types': 'GeoMap Tipos de Activo',
  'Manage reusable asset types, labels, and default colors for GeoMap assets.':
    'Administre tipos de activos, etiquetas y colores predeterminados en GeoMap.',
  'Manage vendor models linked to GeoMap asset types.':
    'Administre modelos de proveedor vinculados a tipos de activo de GeoMap.',
  'Register vendor models linked to GeoMap asset types.':
    'Registre modelos de proveedor vinculados a tipos de activo de GeoMap.',
  'Point of Presence catalog for your ISP network.':
    'Catálogo de puntos de presencia para su red ISP.',
  'Search due day rule': 'Buscar regla de vencimiento',
  'Search Softswitch accounts': 'Buscar cuentas de Softswitch',
  'Name, due day, billing day, status': 'Nombre, día de vencimiento, día de facturación, estado',
  'Name, alias, document, city': 'Nombre, alias, documento, ciudad',
  'e.g. FTTH Zone North': 'p. ej.: Zona FTTH Norte',
  'No VPS instances yet': 'Aún no hay instancias VPS',
  'Configure due day, billing day and closed month rules.':
    'Configure reglas de día de vencimiento, día de facturación y mes de cierre.',
  'Manage contract lifecycle and billing context.':
    'Gestione el ciclo de vida de contratos y el contexto de facturación.',
  'Create your first VPS provider to enable provisioning.':
    'Cree su primer proveedor VPS para habilitar el aprovisionamiento.',
  'Create your first VPS entry to start tracking infrastructure.':
    'Cree su primer registro VPS para comenzar el seguimiento de infraestructura.',
  Save: 'Guardar',
  save: 'guardar',
  Cancel: 'Cancelar',
  Close: 'Cerrar',
  Clear: 'Limpiar',
  New: 'Nuevo',
  Apply: 'Aplicar',
  'Delete selected': 'Eliminar seleccionados',
  'Cancel selected': 'Cancelar seleccionados',
  selected: 'seleccionado(s)',
  Billing: 'Facturación',
  'Billing Control': 'Control de facturación',
  'Prepaid balance, service catalog, subscriptions and ledger.':
    'Saldo prepago, catálogo de servicios, suscripciones y extracto.',
  'Global products, price book, subscriptions and prepaid credit operations.':
    'Productos globales, lista de precios, suscripciones y operaciones de crédito prepago.',
  'Active products': 'Productos activos',
  'Active prices': 'Precios activos',
  'Active subscriptions': 'Suscripciones activas',
  'Available catalog': 'Catálogo disponible',
  'Ledger entries': 'Movimientos del extracto',
  'Products and price options': 'Productos y opciones de precio',
  'Financial movements': 'Movimientos financieros',
  'No wallet': 'Sin cartera',
  'Add prepaid credit before contracting paid services.':
    'Agregue crédito prepago antes de contratar servicios pagos.',
  'Add credit': 'Agregar crédito',
  Wallets: 'Carteras',
  'Wallet operations': 'Operaciones de cartera',
  'Apply audited prepaid credits to tenant wallets.':
    'Aplique créditos prepagos auditados a las carteras de los entornos.',
  Catalog: 'Catálogo',
  Subscriptions: 'Suscripciones',
  Ledger: 'Extracto',
  'Search products': 'Buscar productos',
  'Search prices': 'Buscar precios',
  'Search subscriptions': 'Buscar suscripciones',
  'Search products or resources': 'Buscar productos o recursos',
  'Search ledger': 'Buscar extracto',
  'Subscription status': 'Estado de suscripción',
  'Pending payment': 'Pago pendiente',
  Mode: 'Modo',
  'Unit price': 'Precio unitario',
  Setup: 'Instalación',
  Subscribe: 'Suscribirse',
  Resource: 'Recurso',
  Qty: 'Cant.',
  Date: 'Fecha',
  Direction: 'Dirección',
  Balance: 'Saldo',
  Reason: 'Motivo',
  'No products available.': 'No hay productos disponibles.',
  'No products found.': 'No se encontraron productos.',
  'No prices found.': 'No se encontraron precios.',
  'No subscriptions found.': 'No se encontraron suscripciones.',
  'No ledger entries found.': 'No se encontraron movimientos.',
  All: 'Todos',
  None: 'Ninguno',
  Search: 'Buscar',
  Refresh: 'Actualizar',
  Add: 'Agregar',
  add: 'agregar',
  edit: 'editar',
  delete: 'eliminar',
  refresh: 'actualizar',
  close: 'cerrar',
  Edit: 'Editar',
  Delete: 'Eliminar',
  Active: 'Activo',
  Inactive: 'Inactivo',
  Status: 'Estado',
  Name: 'Nombre',
  Description: 'Descripción',
  Type: 'Tipo',
  Email: 'Correo',
  Phone: 'Teléfono',
  Number: 'Número',
  Notes: 'Notas',
  Actions: 'Acciones',
  Default: 'Predeterminado',
  Customer: 'Cliente',
  Supplier: 'Proveedor',
  Document: 'Documento',
  Due: 'Vencimiento',
  'Due date': 'Fecha de vencimiento',
  'Due Date': 'Fecha de Vencimiento',
  City: 'Ciudad',
  State: 'Estado',
  Country: 'País',
  Street: 'Calle',
  District: 'Distrito',
  Zip: 'Código Postal',
  Region: 'Región',
  Company: 'Empresa',
  Provider: 'Proveedor',
  Title: 'Título',
  Code: 'Código',
  Password: 'Contraseña',
  'New Password': 'Nueva Contraseña',
  'First Name': 'Nombre',
  'Last Name': 'Apellido',
  Person: 'Persona',
  Nick: 'Apodo',
  Website: 'Sitio web',
  Username: 'Usuario',
  Subject: 'Asunto',
  Priority: 'Prioridad',
  Stage: 'Etapa',
  Result: 'Resultado',
  Value: 'Valor',
  Plan: 'Plan',
  'Size / Plan': 'Tamaño / Plan',
  Method: 'Método',
  Channel: 'Canal',
  Operator: 'Operador',
  Vendor: 'Proveedor',
  Model: 'Modelo',
  'Vendor Model': 'Modelo de Proveedor',
  Price: 'Precio',
  Product: 'Producto',
  Category: 'Categoría',
  Brand: 'Marca',
  Domain: 'Dominio',
  Role: 'Rol',
  User: 'Usuario',
  Unit: 'Unidad',
  Discount: 'Descuento',
  Total: 'Total',
  Sent: 'Enviado',
  Draft: 'Borrador',
  Rejected: 'Rechazado',
  Primary: 'Principal',
  'Issue date': 'Fecha de emisión',
  'Start date': 'Fecha de inicio',
  'End date': 'Fecha de fin',
  'Valid Until': 'Válido hasta',
  'Unit Price': 'Precio unitario',
  'Document number': 'Número de documento',
  'Display name': 'Nombre para mostrar',
  'No provider accounts yet': 'Aún no hay cuentas de proveedor',
  'Access level': 'Nivel de acceso',
  'Event Type': 'Tipo de evento',
  'Access token': 'Token de acceso',
  'Access Key ID': 'ID de clave de acceso',
  'Secret Access Key': 'Clave secreta de acceso',
  'API Key': 'Clave API',
  'API Secret': 'Secreto API',
  'Base URL': 'URL base',
  'Unt. Code': 'Código UNT',
  Verify: 'Verificar',
  'Verify token': 'Verificar token',
  Disconnect: 'Desconectar',
  'Loading...': 'Cargando...',
  'Sign in': 'Iniciar sesión',
  'Sign In': 'Iniciar sesión',
  'Recover Password': 'Recuperar Contraseña',
  'Send Instructions': 'Enviar instrucciones',
  'Access your mnscloud account': 'Accede a tu cuenta de mnscloud',
  'Forgot your password?': '¿Olvidaste tu contraseña?',
  'Create one': 'Crear una',
  "Don't have an account?": '¿No tienes una cuenta?',
  'Welcome Back': 'Bienvenido de nuevo',
  'My Profile': 'Mi Perfil',
  Logout: 'Salir',
  Settings: 'Configuración',
  Offline: 'Sin conexión',
  'No environments': 'Sin entornos',
  'No environment': 'Sin entorno',
  'Set default': 'Definir predeterminado',
  'All rights reserved.': 'Todos los derechos reservados.',
  'Good morning': 'Buenos días',
  'Good afternoon': 'Buenas tardes',
  'Good evening': 'Buenas noches',
  'You must enter a value': 'Debes ingresar un valor',
  'Not a valid email': 'Correo inválido',
  'Invalid credentials.': 'Credenciales inválidas.',
  'Invalid API response': 'Respuesta inválida de la API',
  'Welcome back!': 'Bienvenido de nuevo',
  'Search menu...': 'Buscar en el menú...',
};

const COMMON_EN_TO_PT = {
  ...AUTO_EN_TO_PT,
  ...COMMON_EN_TO_PT_MANUAL,
};

const COMMON_EN_TO_ES = {
  ...AUTO_EN_TO_ES,
  ...COMMON_EN_TO_ES_MANUAL,
};

const COMMON_PT_TO_EN = Object.fromEntries(
  Object.entries(COMMON_EN_TO_PT).map(([en, pt]) => [pt, en]),
);

const COMMON_ES_TO_EN = Object.fromEntries(
  Object.entries(COMMON_EN_TO_ES).map(([en, es]) => [es, en]),
);

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  'en-US': {
    'layout.searchMenu': 'Search menu...',
    'layout.offline': 'Offline',
    'layout.noEnvironment': 'No environment',
    'layout.noEnvironments': 'No environments',
    'layout.setDefault': 'Set default',
    'layout.footer': 'All rights reserved.',
    'lang.portuguese': 'Portuguese (Brazil)',
    'lang.english': 'English (US)',
    'lang.spanish': 'Spanish (Spain)',
    'lang.auto': 'Automatic (System)',
    'signin.title': 'Welcome Back',
    'signin.subtitle': 'Access your mnscloud account',
    'signin.language': 'Language',
    'signin.email': 'Email',
    'signin.password': 'Password',
    'signin.forgotPassword': 'Forgot your password?',
    'signin.submit': 'Sign In',
    'signin.noAccount': "Don't have an account?",
    'signin.createAccount': 'Create one',
    'signin.showPassword': 'Show password',
    'signin.hidePassword': 'Hide password',
    'signin.error.invalidResponse': 'Invalid API response',
    'signin.error.invalidCredentials': 'Invalid credentials.',
    'signin.error.requiredEmail': 'You must enter a value',
    'signin.error.invalidEmail': 'Not a valid email',
    'signin.success.welcomeBack': 'Welcome back!',
    'menu.myProfile': 'My Profile',
    'menu.settings': 'Settings',
    'menu.logout': 'Logout',
    'greeting.morning': 'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',
    'snackbar.close': 'Close',
  },
  'pt-BR': {
    'layout.searchMenu': 'Buscar no menu...',
    'layout.offline': 'Offline',
    'layout.noEnvironment': 'Sem ambiente',
    'layout.noEnvironments': 'Sem ambientes',
    'layout.setDefault': 'Definir padrão',
    'layout.footer': 'Todos os direitos reservados.',
    'lang.portuguese': 'Português (Brasil)',
    'lang.english': 'Inglês (EUA)',
    'lang.spanish': 'Espanhol (Espanha)',
    'lang.auto': 'Automático (Sistema)',
    'signin.title': 'Bem-vindo de volta',
    'signin.subtitle': 'Acesse sua conta mnscloud',
    'signin.language': 'Idioma',
    'signin.email': 'E-mail',
    'signin.password': 'Senha',
    'signin.forgotPassword': 'Esqueceu sua senha?',
    'signin.submit': 'Entrar',
    'signin.noAccount': 'Não tem uma conta?',
    'signin.createAccount': 'Criar uma',
    'signin.showPassword': 'Mostrar senha',
    'signin.hidePassword': 'Ocultar senha',
    'signin.error.invalidResponse': 'Resposta inválida da API',
    'signin.error.invalidCredentials': 'Credenciais inválidas.',
    'signin.error.requiredEmail': 'Você deve informar um valor',
    'signin.error.invalidEmail': 'E-mail inválido',
    'signin.success.welcomeBack': 'Bem-vindo de volta!',
    'menu.myProfile': 'Meu Perfil',
    'menu.settings': 'Configurações',
    'menu.logout': 'Sair',
    'greeting.morning': 'Bom dia',
    'greeting.afternoon': 'Boa tarde',
    'greeting.evening': 'Boa noite',
    'snackbar.close': 'Fechar',
  },
  'es-ES': {
    'layout.searchMenu': 'Buscar en el menú...',
    'layout.offline': 'Sin conexión',
    'layout.noEnvironment': 'Sin entorno',
    'layout.noEnvironments': 'Sin entornos',
    'layout.setDefault': 'Definir predeterminado',
    'layout.footer': 'Todos los derechos reservados.',
    'lang.portuguese': 'Portugués (Brasil)',
    'lang.english': 'Inglés (EE. UU.)',
    'lang.spanish': 'Español (España)',
    'lang.auto': 'Automático (Sistema)',
    'signin.title': 'Bienvenido de nuevo',
    'signin.subtitle': 'Accede a tu cuenta de mnscloud',
    'signin.language': 'Idioma',
    'signin.email': 'Correo',
    'signin.password': 'Contraseña',
    'signin.forgotPassword': '¿Olvidaste tu contraseña?',
    'signin.submit': 'Iniciar sesión',
    'signin.noAccount': '¿No tienes una cuenta?',
    'signin.createAccount': 'Crear una',
    'signin.showPassword': 'Mostrar contraseña',
    'signin.hidePassword': 'Ocultar contraseña',
    'signin.error.invalidResponse': 'Respuesta inválida de la API',
    'signin.error.invalidCredentials': 'Credenciales inválidas.',
    'signin.error.requiredEmail': 'Debes ingresar un valor',
    'signin.error.invalidEmail': 'Correo inválido',
    'signin.success.welcomeBack': 'Bienvenido de nuevo',
    'menu.myProfile': 'Mi Perfil',
    'menu.settings': 'Configuración',
    'menu.logout': 'Salir',
    'greeting.morning': 'Buenos días',
    'greeting.afternoon': 'Buenas tardes',
    'greeting.evening': 'Buenas noches',
    'snackbar.close': 'Cerrar',
  },
};

export function resolveInitialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en-US';

  const mode = localStorage.getItem(I18N_MODE_STORAGE_KEY);
  const stored = localStorage.getItem(I18N_STORAGE_KEY);
  if (mode === 'manual' && (stored === 'pt-BR' || stored === 'en-US' || stored === 'es-ES')) {
    return stored;
  }

  return detectLanguageFromNavigator();
}

function detectLanguageFromNavigator(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en-US';
  const browserLanguage = navigator.language.toLowerCase();
  if (browserLanguage.startsWith('pt')) return 'pt-BR';
  if (browserLanguage.startsWith('es')) return 'es-ES';
  return 'en-US';
}

function resolveInitialLanguageMode(): AppLanguageMode {
  if (typeof window === 'undefined') return 'auto';
  return localStorage.getItem(I18N_MODE_STORAGE_KEY) === 'manual' ? 'manual' : 'auto';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly languageOptions = [
    { code: 'auto' as const, labelKey: 'lang.auto' },
    { code: 'pt-BR' as AppLanguage, labelKey: 'lang.portuguese' },
    { code: 'en-US' as AppLanguage, labelKey: 'lang.english' },
    { code: 'es-ES' as AppLanguage, labelKey: 'lang.spanish' },
  ];

  readonly availableLanguages = [
    { code: 'pt-BR' as AppLanguage, labelKey: 'lang.portuguese' },
    { code: 'en-US' as AppLanguage, labelKey: 'lang.english' },
    { code: 'es-ES' as AppLanguage, labelKey: 'lang.spanish' },
  ];

  readonly language = signal<AppLanguage>(resolveInitialLanguage());
  readonly languageMode = signal<AppLanguageMode>(resolveInitialLanguageMode());
  readonly selectedLanguageOption = computed<LanguageOptionCode>(() =>
    this.languageMode() === 'auto' ? 'auto' : this.language(),
  );

  constructor() {
    this.syncDocumentLanguage(this.language());
    this.bindNavigatorLanguageChange();
  }

  t(key: string): string {
    const lang = this.language();
    return TRANSLATIONS[lang][key] ?? TRANSLATIONS['en-US'][key] ?? this.translateLiteral(key);
  }

  translateLiteral(value: string): string {
    if (typeof value !== 'string') return String(value ?? '');
    const match = value.match(/^(\s*)(.*?)(\s*)$/);
    if (!match) return value;

    const [, left, core, right] = match;
    if (!core) return value;

    const translated = this.translateCoreLiteral(core);
    return `${left}${translated}${right}`;
  }

  private translateCoreLiteral(core: string): string {
    const language = this.language();

    if (language === 'pt-BR') {
      return COMMON_EN_TO_PT[core] ?? COMMON_ES_TO_EN[core] ?? core;
    }

    if (language === 'es-ES') {
      return COMMON_EN_TO_ES[core] ?? COMMON_PT_TO_EN[core] ?? core;
    }

    return COMMON_PT_TO_EN[core] ?? COMMON_ES_TO_EN[core] ?? core;
  }

  translateMenuLabel(label: string): string {
    const language = this.language();
    if (language === 'pt-BR') return MENU_TRANSLATIONS_PT[label] ?? label;
    if (language === 'es-ES') return MENU_TRANSLATIONS_ES[label] ?? label;
    return label;
  }

  setLanguage(language: AppLanguage, reload = false) {
    this.language.set(language);
    this.languageMode.set('manual');

    if (typeof window !== 'undefined') {
      localStorage.setItem(I18N_STORAGE_KEY, language);
      localStorage.setItem(I18N_MODE_STORAGE_KEY, 'manual');
    }

    this.syncDocumentLanguage(language);

    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  useSystemLanguage(reload = false) {
    const systemLanguage = detectLanguageFromNavigator();
    this.languageMode.set('auto');
    this.language.set(systemLanguage);

    if (typeof window !== 'undefined') {
      localStorage.setItem(I18N_MODE_STORAGE_KEY, 'auto');
      localStorage.removeItem(I18N_STORAGE_KEY);
    }

    this.syncDocumentLanguage(systemLanguage);

    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private syncDocumentLanguage(language: AppLanguage) {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }

  private bindNavigatorLanguageChange() {
    if (typeof window === 'undefined') return;

    window.addEventListener('languagechange', () => {
      if (this.languageMode() !== 'auto') return;
      const systemLanguage = detectLanguageFromNavigator();
      this.language.set(systemLanguage);
      this.syncDocumentLanguage(systemLanguage);
    });
  }
}
