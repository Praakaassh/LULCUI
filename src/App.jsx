import { useState } from 'react'
import './App.css'

function App() {
  const [num1, setNum1] = useState('')
  const [num2, setNum2] = useState('')
  const [operator, setOperator] = useState('+')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    const a = parseFloat(num1)
    const b = parseFloat(num2)

    if (isNaN(a) || isNaN(b)) {
      setError('Please enter valid numbers.')
      setResult(null)
      return
    }

    let res

    switch (operator) {
      case '+':
        res = a + b
        break
      case '-':
        res = a - b
        break
      case '*':
        res = a * b
        break
      case '/':
        if (b === 0) {
          setError('Cannot divide by zero.')
          setResult(null)
          return
        }
        res = a / b
        break
      default:
        res = NaN
    }

    setError('')
    setResult(res)
  }

  return (
    <div className="app">
      <h1>Basic Calculator</h1>
      <div className="calculator">
        <input
          type="number"
          value={num1}
          onChange={(e) => setNum1(e.target.value)}
          placeholder="First number"
        />

        <select
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          <option value="+">+</option>
          <option value="-">-</option>
          <option value="*">*</option>
          <option value="/">/</option>
        </select>

        <input
          type="number"
          value={num2}
          onChange={(e) => setNum2(e.target.value)}
          placeholder="Second number"
        />

        <button onClick={calculate}>Calculate</button>
      </div>

      {error && <p className="error">{error}</p>}
      {result !== null && !error && (
        <p className="result">Result: {result}</p>
      )}
    </div>
  )
}

export default App
