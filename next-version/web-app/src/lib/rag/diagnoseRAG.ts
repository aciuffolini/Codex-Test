/**
 * Diagnostic tool for RAG service connection
 * Run in browser console to check RAG connectivity
 */

export async function diagnoseRAG() {
  console.log('🔍 Diagnosing RAG Service Connection...\n');
  
  const results: any = {
    ragServerUrl: null,
    serviceHealth: null,
    chromaRecords: null,
    searchTest: null,
    errors: [],
  };
  
  // 1. Check RAG Server URL
  const ragServerUrl = import.meta.env.VITE_RAG_SERVER_URL || localStorage.getItem('rag_server_url') || 'http://localhost:8000';
  results.ragServerUrl = ragServerUrl;
  console.log(`1. RAG Server URL: ${ragServerUrl}`);
  
  // 2. Check service health
  try {
    const healthResponse = await fetch(`${ragServerUrl}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      results.serviceHealth = health;
      console.log(`✅ Service is running:`, health);
    } else {
      results.errors.push(`Health check failed: ${healthResponse.statusText}`);
      console.error(`❌ Health check failed: ${healthResponse.statusText}`);
    }
  } catch (err: any) {
    results.errors.push(`Health check error: ${err.message}`);
    console.error(`❌ Health check error:`, err.message);
  }
  
  // 3. Check ChromaDB records
  try {
    const { getRAGClient } = await import('../services/ragClient');
    const ragClient = getRAGClient({ serverUrl: ragServerUrl });
    
    // Try a simple search
    const searchResults = await ragClient.search('test', 5);
    results.chromaRecords = searchResults.length;
    console.log(`✅ ChromaDB search works. Found ${searchResults.length} records`);
    
    if (searchResults.length === 0) {
      console.warn('⚠️  No records in ChromaDB. Records need to be synced and embeddings generated.');
    }
  } catch (err: any) {
    results.errors.push(`ChromaDB search error: ${err.message}`);
    console.error(`❌ ChromaDB search error:`, err.message);
  }
  
  // 4. Test actual search
  try {
    const { getRAGClient } = await import('../services/ragClient');
    const { parseQueryFilters } = await import('./queryParser');
    const ragClient = getRAGClient({ serverUrl: ragServerUrl });
    
    const testQuery = 'field 12';
    const filters = parseQueryFilters(testQuery);
    const searchResults = await ragClient.search(testQuery, 5, filters);
    
    results.searchTest = {
      query: testQuery,
      filters,
      results: searchResults.length,
      sample: searchResults[0] || null,
    };
    
    console.log(`✅ Search test successful:`);
    console.log(`   Query: "${testQuery}"`);
    console.log(`   Filters:`, filters);
    console.log(`   Results: ${searchResults.length}`);
    if (searchResults.length > 0) {
      console.log(`   Sample:`, searchResults[0]);
    }
  } catch (err: any) {
    results.errors.push(`Search test error: ${err.message}`);
    console.error(`❌ Search test error:`, err.message);
  }
  
  // 5. Check SQLite records
  try {
    const sqliteResponse = await fetch(`${ragServerUrl}/visits/e6ebf6d8-47f0-414d-9ec9-5f370a57d64a`);
    if (sqliteResponse.ok) {
      const visit = await sqliteResponse.json();
      console.log(`✅ SQLite access works. Sample visit:`, {
        id: visit.id,
        field_id: visit.field_id,
        crop: visit.crop,
        issue: visit.issue,
      });
    } else {
      console.warn(`⚠️  SQLite access failed: ${sqliteResponse.statusText}`);
    }
  } catch (err: any) {
    console.warn(`⚠️  SQLite check error:`, err.message);
  }
  
  console.log('\n📊 Summary:');
  console.log('='.repeat(60));
  console.log(`RAG Server URL: ${results.ragServerUrl}`);
  console.log(`Service Health: ${results.serviceHealth ? '✅ OK' : '❌ Failed'}`);
  console.log(`ChromaDB Records: ${results.chromaRecords ?? 'Unknown'}`);
  console.log(`Search Test: ${results.searchTest ? '✅ OK' : '❌ Failed'}`);
  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach((err: string) => console.log(`   - ${err}`));
  }
  
  return results;
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).diagnoseRAG = diagnoseRAG;
}


