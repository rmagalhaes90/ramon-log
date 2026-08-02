export type Locale = 'pt' | 'en';

const messages = {
  pt: {
    tagline: 'Treino e progresso, mesmo offline.',
    foundation: 'Fundação v4 em construção',
    baseline: 'Abrir versão estável',
    online: 'Online',
    offline: 'Offline — alterações entrarão na fila',
    update: 'Nova versão disponível',
    updateNow: 'Atualizar agora',
    auth: 'Autenticação modular pronta para integração',
    queue: 'Itens pendentes',
    error: 'Algo não saiu como esperado. Seus dados locais foram preservados.',
    login: 'Entrar', signup: 'Criar conta', email: 'Email', password: 'Senha',
    google: 'Continuar com Google', forgot: 'Esqueci minha senha', logout: 'Sair',
    verifyTitle: 'Verifique seu email', verifyBody: 'Enviamos um link de confirmação para seu email.',
    verifyAgain: 'Reenviar email', verifyCheck: 'Já verifiquei', useAnother: 'Usar outra conta',
    resetSent: 'Se existir uma conta para este email, enviaremos as instruções de recuperação.',
    passwordHint: 'Use 12 caracteres com maiúscula, minúscula e número.',
    authInvalid: 'Email ou senha incorretos.', authGeneric: 'Não foi possível autenticar agora.',
    authRate: 'Muitas tentativas. Aguarde e tente novamente.', verifySent: 'Email de verificação enviado.',
    verifyPending: 'A verificação ainda não foi confirmada.', welcome: 'Bem-vindo ao KYRO.',
    onboardingBody: 'Defina suas preferências iniciais. Você poderá alterá-las depois.',
    metric: 'Métrico (kg/cm)', imperial: 'Imperial (lb/in)', continue: 'Continuar',
    train: 'Treinar', noWorkout: 'Nenhum treino configurado para este dia.', finishWorkout: 'Concluir treino',
    load: 'Carga', reps: 'Repetições', rest: 'Descanso', syncPending: 'Salvo localmente; sincronização pendente.',
    workoutSaved: 'Treino registrado.', back: 'Voltar',
    progress: 'Progresso', nutrition: 'Nutrição', weight: 'Peso', add: 'Adicionar', readiness: 'Readiness',
    sleep: 'Sono', energy: 'Energia', soreness: 'Dor muscular', stress: 'Stress', save: 'Salvar',
    history: 'Histórico', calories: 'Calorias', protein: 'Proteína', carbs: 'Carboidratos', fat: 'Gordura',
    water: 'Água', meal: 'Refeição', mealName: 'Nome da refeição',
    settings: 'Ajustes', deleteAccount: 'Excluir conta e todos os dados', deleteWarning: 'Esta ação é permanente. Digite EXCLUIR para confirmar.',
    confirmation: 'Confirmação', deleting: 'Excluindo com segurança…', deleteFailed: 'Não foi possível concluir a exclusão. Nenhum passo restante será ocultado.',
    admin: 'Administração', users: 'Usuários', block: 'Bloquear', unblock: 'Desbloquear', grantAdmin: 'Tornar admin', revokeAdmin: 'Remover admin',
    addExercise: 'Adicionar exercício', remove: 'Remover', search: 'Buscar exercício', editRoutine: 'Editar rotina', routineName: 'Nome da rotina',
    sessionTime: 'Tempo de treino', startRest: 'Iniciar descanso', notes: 'Notas', plates: 'Placas por lado', warmup: 'Aquecimento', newRecord: 'Novo recorde',
    supplements: 'Suplementos', schedule: 'Horário', taken: 'Tomado', addSupplement: 'Adicionar suplemento', noSupplements: 'Nenhum suplemento configurado.',
  },
  en: {
    tagline: 'Training and progress, even offline.',
    foundation: 'v4 foundation in progress',
    baseline: 'Open stable version',
    online: 'Online',
    offline: 'Offline — changes will be queued',
    update: 'A new version is available',
    updateNow: 'Update now',
    auth: 'Modular authentication ready for integration',
    queue: 'Pending items',
    error: 'Something went wrong. Your local data was preserved.',
    login: 'Sign in', signup: 'Create account', email: 'Email', password: 'Password',
    google: 'Continue with Google', forgot: 'Forgot password', logout: 'Sign out',
    verifyTitle: 'Verify your email', verifyBody: 'We sent a confirmation link to your email.',
    verifyAgain: 'Resend email', verifyCheck: 'I have verified', useAnother: 'Use another account',
    resetSent: 'If an account exists for this email, recovery instructions will be sent.',
    passwordHint: 'Use 12 characters with uppercase, lowercase and a number.',
    authInvalid: 'Incorrect email or password.', authGeneric: 'Authentication is unavailable right now.',
    authRate: 'Too many attempts. Wait and try again.', verifySent: 'Verification email sent.',
    verifyPending: 'Verification has not been confirmed yet.', welcome: 'Welcome to KYRO.',
    onboardingBody: 'Set your initial preferences. You can change them later.',
    metric: 'Metric (kg/cm)', imperial: 'Imperial (lb/in)', continue: 'Continue',
    train: 'Train', noWorkout: 'No workout configured for this day.', finishWorkout: 'Finish workout',
    load: 'Load', reps: 'Reps', rest: 'Rest', syncPending: 'Saved locally; sync pending.',
    workoutSaved: 'Workout logged.', back: 'Back',
    progress: 'Progress', nutrition: 'Nutrition', weight: 'Weight', add: 'Add', readiness: 'Readiness',
    sleep: 'Sleep', energy: 'Energy', soreness: 'Soreness', stress: 'Stress', save: 'Save',
    history: 'History', calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
    water: 'Water', meal: 'Meal', mealName: 'Meal name',
    settings: 'Settings', deleteAccount: 'Delete account and all data', deleteWarning: 'This is permanent. Type DELETE to confirm.',
    confirmation: 'Confirmation', deleting: 'Deleting securely…', deleteFailed: 'Deletion could not be completed. No remaining step will be hidden.',
    admin: 'Administration', users: 'Users', block: 'Block', unblock: 'Unblock', grantAdmin: 'Grant admin', revokeAdmin: 'Revoke admin',
    addExercise: 'Add exercise', remove: 'Remove', search: 'Search exercise', editRoutine: 'Edit routine', routineName: 'Routine name',
    sessionTime: 'Workout time', startRest: 'Start rest', notes: 'Notes', plates: 'Plates per side', warmup: 'Warm-up', newRecord: 'New record',
    supplements: 'Supplements', schedule: 'Schedule', taken: 'Taken', addSupplement: 'Add supplement', noSupplements: 'No supplements configured.',
  },
} as const;

export type MessageKey = keyof (typeof messages)['pt'];

export function detectLocale(): Locale {
  const query = new URLSearchParams(location.search).get('lang');
  if (query === 'pt' || query === 'en') return query;
  const saved = localStorage.getItem('kyro-v4-locale');
  if (saved === 'pt' || saved === 'en') return saved;
  return /^pt(?:-|$)/i.test(navigator.language) ? 'pt' : 'en';
}

export function createI18n(initial = detectLocale()) {
  let locale: Locale = initial;
  return {
    get locale() {
      return locale;
    },
    t: (key: MessageKey): string => messages[locale][key],
    setLocale(next: Locale): void {
      locale = next;
      localStorage.setItem('kyro-v4-locale', next);
      document.documentElement.lang = next === 'pt' ? 'pt-BR' : 'en';
    },
  };
}
