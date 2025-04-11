import React, { useState, useEffect } from 'react'
import { Card, Input, Button, Select, Typography, Space, Spin } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { 
  getJupiterQuote, 
  executeJupiterSwap, 
  QuoteResponse 
} from '../services/jupiterService'
import { 
  fetchWalletInfo, 
  SOL_MINT, 
  USDC_MINT, 
  WalletInfo,
  fetchTokenDecimals
} from '../services/walletService'
import notification from '../utils/notification'

const { Option } = Select
const { Text, Title } = Typography

const Test: React.FC = () => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [swapLoading, setSwapLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [fromToken, setFromToken] = useState(SOL_MINT)
  const [toToken, setToToken] = useState(USDC_MINT)
  const [solDecimals, setSolDecimals] = useState(9)
  const [usdcDecimals, setUsdcDecimals] = useState(6)

  useEffect(() => {
    loadWalletInfo()
    loadTokenDecimals()
  }, [])

  const loadWalletInfo = async () => {
    setLoading(true)
    try {
      const info = await fetchWalletInfo()
      setWalletInfo(info)
    } catch (error) {
      console.error('Error loading wallet info:', error)
      notification.error('Failed to load wallet information')
    } finally {
      setLoading(false)
    }
  }

  const loadTokenDecimals = async () => {
    try {
      const solDec = await fetchTokenDecimals(SOL_MINT)
      const usdcDec = await fetchTokenDecimals(USDC_MINT)
      setSolDecimals(solDec)
      setUsdcDecimals(usdcDec)
    } catch (error) {
      console.error('Error loading token decimals:', error)
    }
  }

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setQuote(null)
  }

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      notification.error('Please enter a valid amount')
      return
    }

    setQuoteLoading(true)
    try {
      const decimals = fromToken === SOL_MINT ? solDecimals : usdcDecimals
      const amountInSmallestUnit = (parseFloat(amount) * Math.pow(10, decimals)).toString()

      const quoteResponse = await getJupiterQuote({
        inputMint: fromToken,
        outputMint: toToken,
        amount: amountInSmallestUnit,
        slippageBps: 50 // 0.5% slippage
      })

      setQuote(quoteResponse)
    } catch (error) {
      console.error('Error getting quote:', error)
      notification.error('Failed to get swap quote')
    } finally {
      setQuoteLoading(false)
    }
  }

  const executeSwap = async () => {
    if (!quote) {
      notification.error('Please get a quote first')
      return
    }

    setSwapLoading(true)
    try {
      const result = await executeJupiterSwap(quote)
      if (result) {
        notification.success(
          `Swap successful! View transaction: ${result.explorerUrl}`
        )
        // Refresh wallet info
        await loadWalletInfo()
        setQuote(null)
        setAmount('')
      }
    } catch (error) {
      console.error('Error executing swap:', error)
      notification.error('Failed to execute swap')
    } finally {
      setSwapLoading(false)
    }
  }

  const formatBalance = (balance: number, decimals: number) => {
    return balance.toFixed(decimals === 9 ? 4 : 2)
  }

  const getExpectedOutput = () => {
    if (!quote) return null
    
    const outputDecimals = toToken === SOL_MINT ? solDecimals : usdcDecimals
    return (parseInt(quote.outAmount) / Math.pow(10, outputDecimals)).toFixed(outputDecimals === 9 ? 4 : 2)
  }

  return (
    <div className="container mx-auto p-4">
      <Title level={2}>SOL/USDC Swap Test</Title>
      
      <Card className="mb-4">
        <Spin spinning={loading}>
          <Title level={4}>Wallet Balances</Title>
          {walletInfo ? (
            <Space direction="vertical">
              <Text>SOL: {formatBalance(walletInfo.solBalance, solDecimals)} SOL</Text>
              <Text>USDC: {formatBalance(walletInfo.usdcBalance, usdcDecimals)} USDC</Text>
            </Space>
          ) : (
            <Text>No wallet information available</Text>
          )}
        </Spin>
      </Card>

      <Card title="Swap Tokens">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Select 
              value={fromToken} 
              onChange={setFromToken} 
              style={{ width: 120 }}
              disabled={quoteLoading || swapLoading}
            >
              <Option value={SOL_MINT}>SOL</Option>
              <Option value={USDC_MINT}>USDC</Option>
            </Select>
            <Input 
              placeholder="Amount" 
              value={amount} 
              onChange={e => setAmount(e.target.value)}
              style={{ margin: '0 16px', flex: 1 }}
              disabled={quoteLoading || swapLoading}
              type="number"
              min="0"
            />
            <Button 
              type="default" 
              icon={<SwapOutlined />} 
              onClick={handleSwapTokens}
              disabled={quoteLoading || swapLoading}
            />
          </div>
          
          <Select 
            value={toToken} 
            onChange={setToToken} 
            style={{ width: 120 }}
            disabled={quoteLoading || swapLoading}
          >
            <Option value={SOL_MINT}>SOL</Option>
            <Option value={USDC_MINT}>USDC</Option>
          </Select>

          {quote && (
            <div style={{ marginTop: 16 }}>
              <Text>Expected output: {getExpectedOutput()} {toToken === SOL_MINT ? 'SOL' : 'USDC'}</Text>
              <br />
              <Text>Price impact: {(parseFloat(quote.priceImpactPct) * 100).toFixed(2)}%</Text>
            </div>
          )}

          <Space style={{ marginTop: 16 }}>
            <Button 
              type="primary" 
              onClick={getQuote} 
              loading={quoteLoading}
              disabled={swapLoading || !amount}
            >
              Get Quote
            </Button>
            <Button 
              type="primary" 
              onClick={executeSwap} 
              loading={swapLoading}
              disabled={!quote || quoteLoading}
            >
              Swap
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

export default Test 