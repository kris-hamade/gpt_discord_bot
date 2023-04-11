function getPersonaText(persona) {
    switch (persona.toLowerCase()) {
      case 'friendly':
        return 'You are a friendly AI assistant.';
      case 'professional':
        return 'You are a professional AI assistant.';
      case 'humorous':
        return 'You are a humorous AI assistant.';
      default:
        return 'You are an AI assistant.';
    }
  }
  
  module.exports = { getPersonaText };
  