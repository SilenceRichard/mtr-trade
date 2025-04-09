const express = require('express');
const cors = require('cors');
const { analyzePools } = require('./analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Main API endpoint to get all pool data
app.get('/api/pools', async (req, res) => {
  try {
    const analysisResult = await analyzePools();
    
    if (!analysisResult) {
      return res.status(500).json({ 
        error: 'Failed to analyze pools data' 
      });
    }
    
    // Extract only the requested pool categories
    const poolsData = {
      highYieldPools: analysisResult.highYieldPools || [],
      mediumYieldPools: analysisResult.mediumYieldPools || [],
      emergingPools: analysisResult.emergingPools || [],
      avoidPools: analysisResult.avoidPools || [],
      topPoolsByFeeRatio: analysisResult.topPoolsByFeeRatio || []
    };
    
    res.json(poolsData);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Optional: Endpoint to get specific pool category
app.get('/api/pools/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ['highYieldPools', 'mediumYieldPools', 'emergingPools', 'avoidPools', 'safePools', 'topPoolsByFeeRatio'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category', 
        validCategories 
      });
    }
    
    const analysisResult = await analyzePools();
    
    if (!analysisResult || !analysisResult[category]) {
      return res.status(404).json({ 
        error: `No data found for category: ${category}` 
      });
    }
    
    res.json({ [category]: analysisResult[category] });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/pools`);
}); 