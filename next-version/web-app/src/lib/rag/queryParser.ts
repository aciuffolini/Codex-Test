/**
 * Query Parser for RAG Search
 * Extracts field names, time ranges, and other filters from natural language queries
 */

export interface QueryFilters {
  field_id?: string;
  created_at_min?: number; // Timestamp in milliseconds
  crop?: string;
  issue?: string;
}

/**
 * Parse user query to extract filters
 */
export function parseQueryFilters(query: string): QueryFilters {
  const filters: QueryFilters = {};
  const lowerQuery = query.toLowerCase();
  
  // Extract field/paddock ID
  // Patterns: "field 14", "paddock 14", "field_14", "F14", "campo 14", "potrero 14"
  const fieldPatterns = [
    /(?:field|paddock|potrero|campo|f)\s*[_\s]*(\d+)/i,
    /(?:field|paddock|potrero|campo|f)[_\s]*(\d+)/i,
  ];
  
  for (const pattern of fieldPatterns) {
    const match = query.match(pattern);
    if (match) {
      filters.field_id = match[1];
      break;
    }
  }
  
  // Extract time ranges
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const threeMonths = 90 * oneDay;
  const oneYear = 365 * oneDay;
  
  // "last month", "past month", "this month"
  if (lowerQuery.match(/(?:last|past|this)\s+month/)) {
    filters.created_at_min = now - oneMonth;
  }
  // "last week", "past week", "this week"
  else if (lowerQuery.match(/(?:last|past|this)\s+week/)) {
    filters.created_at_min = now - oneWeek;
  }
  // "last 3 months", "past 3 months"
  else if (lowerQuery.match(/(?:last|past)\s+3\s+months?/)) {
    filters.created_at_min = now - threeMonths;
  }
  // "last year", "past year"
  else if (lowerQuery.match(/(?:last|past|this)\s+year/)) {
    filters.created_at_min = now - oneYear;
  }
  // "last N days"
  else {
    const daysMatch = lowerQuery.match(/(?:last|past)\s+(\d+)\s+days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      filters.created_at_min = now - (days * oneDay);
    }
  }
  
  // Extract crop type (if mentioned)
  const cropKeywords: Record<string, string> = {
    'corn': 'corn',
    'maize': 'corn',
    'maíz': 'corn',
    'wheat': 'wheat',
    'trigo': 'wheat',
    'soybean': 'soybean',
    'soy': 'soybean',
    'soja': 'soybean',
    'rice': 'rice',
    'arroz': 'rice',
    'cotton': 'cotton',
    'algodón': 'cotton',
  };
  
  for (const [keyword, crop] of Object.entries(cropKeywords)) {
    if (lowerQuery.includes(keyword)) {
      filters.crop = crop;
      break;
    }
  }
  
  // Extract issue type (if mentioned)
  const issueKeywords: Record<string, string> = {
    'aphid': 'aphids',
    'áfido': 'aphids',
    'pest': 'pests',
    'plaga': 'pests',
    'disease': 'disease',
    'enfermedad': 'disease',
    'weed': 'weeds',
    'maleza': 'weeds',
    'drought': 'drought',
    'sequía': 'drought',
  };
  
  for (const [keyword, issue] of Object.entries(issueKeywords)) {
    if (lowerQuery.includes(keyword)) {
      filters.issue = issue;
      break;
    }
  }
  
  return filters;
}

/**
 * Check if query is asking for historical data
 */
export function isHistoricalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const historicalKeywords = [
    'history', 'historical', 'past', 'previous', 'last', 'record',
    'historial', 'pasado', 'anterior', 'último', 'registro',
    'month', 'week', 'year', 'days', 'mes', 'semana', 'año', 'días'
  ];
  
  return historicalKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Check if query mentions a specific field/paddock
 */
export function mentionsField(query: string): boolean {
  const fieldPatterns = [
    /(?:field|paddock|potrero|campo|f)\s*[_\s]*\d+/i,
  ];
  
  return fieldPatterns.some(pattern => pattern.test(query));
}


