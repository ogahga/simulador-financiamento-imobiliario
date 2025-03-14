// Utility functions for loan simulation

// Convert annual rate to monthly rate
export const annualToMonthlyRate = (annualRate) => {
  return Math.pow(1 + annualRate, 1/12) - 1;
};

// Custom rounding function for term calculation
export const customRound = (x) => {
  const frac = x - Math.floor(x);
  if (frac < 0.5) {
    return Math.floor(x) + 1; // Round down and add 1
  } else {
    return Math.ceil(x); // Round up
  }
};

// Format currency with Brazilian format
export const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Format month as text
export const formatMonth = (month, baseMonth = 1, baseYear = 2023) => {
  const totalMonths = baseMonth + month - 1;
  let year = baseYear + Math.floor(totalMonths / 12);
  let monthNum = totalMonths % 12;
  
  if (monthNum === 0) {
    monthNum = 12;
    year -= 1;
  }
  
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  return `${months[monthNum-1]} de ${year}`;
};

export const expandAmortizationRanges = (amortizationConfig) => {
  const expandedAmortizations = {};
  
  // Para depuração - mostrar formatos recebidos
  console.log("Formatos recebidos:", amortizationConfig);
  
  for (const [rangeOrMonth, value] of Object.entries(amortizationConfig)) {
    // Se for um intervalo com frequência (formato "start-end:step")
    if (typeof rangeOrMonth === 'string' && rangeOrMonth.includes('-') && rangeOrMonth.includes(':')) {
      const [range, step] = rangeOrMonth.split(':');
      const [start, end] = range.split('-').map(Number);
      const frequency = parseInt(step);
      
      console.log(`Processando intervalo com frequência: ${rangeOrMonth}, start=${start}, end=${end}, step=${frequency}`);
      
      // Adicionar todos os meses na frequência especificada
      const generatedMonths = [];
      for (let month = start; month <= end; month += frequency) {
        expandedAmortizations[month] = value;
        generatedMonths.push(month);
      }
      console.log("Meses gerados para intervalo de frequência:", generatedMonths);
    }
    // Se for um intervalo simples (formato "start-end")
    else if (typeof rangeOrMonth === 'string' && rangeOrMonth.includes('-')) {
      const [start, end] = rangeOrMonth.split('-').map(Number);
      
      console.log(`Processando intervalo simples: ${rangeOrMonth}, start=${start}, end=${end}`);
      
      for (let month = start; month <= end; month++) {
        expandedAmortizations[month] = value;
      }
    } 
    // Se for uma lista de meses separados por vírgula
    else if (typeof rangeOrMonth === 'string' && rangeOrMonth.includes(',')) {
      const months = rangeOrMonth.split(',').map(m => m.trim());
      
      console.log(`Processando lista de meses: ${rangeOrMonth}`);
      
      for (const month of months) {
        expandedAmortizations[parseInt(month)] = value;
      }
    } 
    // Se for um mês específico
    else {
      console.log(`Processando mês específico: ${rangeOrMonth}`);
      expandedAmortizations[parseInt(rangeOrMonth)] = value;
    }
  }
  
  // Para depuração - mostrar meses expandidos
  console.log("Meses expandidos:", Object.keys(expandedAmortizations).length, "meses", Object.keys(expandedAmortizations));
  
  return expandedAmortizations;
};

// SAC Simulation Function
export const simulateSac = (principal, term, annualInterest, annualCorrection, insurance, extraAmortizations) => {
  const monthlyInterest = annualToMonthlyRate(annualInterest);
  const monthlyCorrection = annualToMonthlyRate(annualCorrection);
  const MAX_ITERATIONS = 1000;

  // Calculate initial fixed installment
  const correction1 = principal * monthlyCorrection;
  const correctedDebt1 = principal + correction1;
  const amort1 = correctedDebt1 / term;
  const interest1 = correctedDebt1 * monthlyInterest;
  const fixedInstallment = amort1 + interest1 + insurance;

  // Initialize variables
  let balance = principal;
  let currentTerm = term;
  let month = 1;
  const schedule = [];
  let lastAmortMonth = 0;
  let currentFactor = term; // Initialize factor as initial term
  let hadAmortizationPreviousMonth = false; // Flag to indicate if previous month had amortization

  while (balance > 0.01 && month <= MAX_ITERATIONS) {
    const correction = balance * monthlyCorrection;
    const correctedDebt = balance + correction;

    // Normally decrement remaining term
    if (month > 1) {
      if (month > lastAmortMonth) {
        currentTerm = currentTerm - 1;
      }
    }
    
    // Determine FACTOR for this month
    if (month === 1) {
      // In the first month, factor is the initial term
      currentFactor = term;
    } else if (hadAmortizationPreviousMonth) {
      // In the month following an extra amortization, factor is remaining term + 1
      currentFactor = currentTerm + 1;
      hadAmortizationPreviousMonth = false; // Reset flag
    } else {
      // In other months, factor is previous factor - 1
      currentFactor = Math.max(1, currentFactor - 1);
    }
    
    // Apply extra amortization
    // Get value and type of amortization for current month
    // If not found, use 0 and "prazo" type (original behavior)
    let extraAmort = 0;
    let amortType = "prazo";
    let autoGenerated = false;
    
    if (extraAmortizations[month]) {
      if (typeof extraAmortizations[month] === 'object') {
        extraAmort = extraAmortizations[month].value || 0;
        amortType = extraAmortizations[month].type || "prazo";
        autoGenerated = extraAmortizations[month].auto_generated || false;
      } else {
        // Compatibility with old format (just value, no type)
        extraAmort = extraAmortizations[month];
        amortType = "prazo";
        autoGenerated = false;
      }
    }
    
    let monthlyAmort, interest, totalAmort, newBalance, installment, newTerm, actualExtraAmort;
    
    if (extraAmort > 0) {
      lastAmortMonth = month;
      
      // Calculate monthly amortization using current FACTOR
      monthlyAmort = currentFactor > 0 ? correctedDebt / currentFactor : correctedDebt;
      interest = correctedDebt * monthlyInterest;
      
      // Calculate current month's installment (without extra amortization)
      const currentInstallment = monthlyAmort + interest + insurance;
      
      // Limit extra amortization to remaining balance
      const maxExtraAmort = correctedDebt - monthlyAmort;
      actualExtraAmort = Math.min(extraAmort, maxExtraAmort);
      
      // Apply extra amortization
      totalAmort = monthlyAmort + actualExtraAmort;
      newBalance = correctedDebt - totalAmort;
      
      // Different treatment based on amortization type
      if (amortType === "prazo") {
        // LOGIC FOR TERM REDUCTION
        hadAmortizationPreviousMonth = true; // Mark for next month
        
        // Calculate new term after extra amortization
        const nextCorrection = newBalance * monthlyCorrection;
        const nextCorrectedDebt = newBalance + nextCorrection;
        const nextInterest = nextCorrectedDebt * monthlyInterest;
        
        // Use current month's installment instead of initial fixed installment
        const folgaNext = currentInstallment - insurance - nextInterest;
        
        let factorNext = 0;
        if (folgaNext > 0) {
          factorNext = nextCorrectedDebt / folgaNext;
        }
        
        const factorNextRounded = customRound(factorNext);
        newTerm = factorNextRounded;
        
        // Installment doesn't include extra amortization
        installment = monthlyAmort + interest + insurance;
      } else { // amortType === "parcela"
        // LOGIC FOR INSTALLMENT REDUCTION
        // Keep current term without changes
        newTerm = currentTerm;
        
        // We don't change hadAmortizationPreviousMonth because we want to keep
        // the standard factor behavior only for term amortization
        
        // Recalculate new installment based on new balance and same term
        if (newTerm > 0) {
          // Calculate new amortization based on new balance and current term
          const nextCorrection = newBalance * monthlyCorrection;
          const nextCorrectedDebt = newBalance + nextCorrection;
          
          // Keep current term, so factor is not changed
          // New monthly amortization is:
          const newMonthlyAmort = nextCorrectedDebt / currentTerm;
          const nextInterest = nextCorrectedDebt * monthlyInterest;
          const newInstallment = newMonthlyAmort + nextInterest + insurance;
          
          // Use this new reduced installment
          installment = newInstallment;
        } else {
          // Special case - last month
          installment = monthlyAmort + interest + insurance;
        }
      }
    } else {
      // No extra amortization this month
      // Use current factor to calculate monthly amortization
      monthlyAmort = currentFactor <= 0 ? correctedDebt : correctedDebt / currentFactor;
      interest = correctedDebt * monthlyInterest;
      totalAmort = monthlyAmort;
      newBalance = correctedDebt - totalAmort;
      installment = monthlyAmort + interest + insurance;
      
      // Keep remaining term calculated previously
      newTerm = currentTerm;
      actualExtraAmort = 0; // No extra amortization
    }

    // Adjustment for last payment
    if (newBalance < 0.01) {
      totalAmort = correctedDebt;
      const installmentFinal = totalAmort + interest + insurance;
      newBalance = 0.0;
      
      // Add amortization type to record
      const row = {
        month,
        saldoDevedor: balance,
        correction,
        dividaCorrigida: correctedDebt,
        juros: interest,
        amortizacaoMensal: monthlyAmort,
        seguro: insurance,
        amortizacaoExtra: actualExtraAmort,
        tipoAmortizacao: extraAmort > 0 ? amortType : "",
        autoGenerated,
        novoSaldo: newBalance,
        parcela: installmentFinal,
        prazoRemanescente: newTerm,
        fator: currentFactor
      };
      schedule.push(row);
      break;
    } else {
      // Add amortization type to record
      const row = {
        month,
        saldoDevedor: balance,
        correction,
        dividaCorrigida: correctedDebt,
        juros: interest,
        amortizacaoMensal: monthlyAmort,
        seguro: insurance,
        amortizacaoExtra: actualExtraAmort || 0,
        tipoAmortizacao: extraAmort > 0 ? amortType : "",
        autoGenerated,
        novoSaldo: newBalance,
        parcela: installment,
        prazoRemanescente: newTerm,
        fator: currentFactor
      };
      schedule.push(row);
    }

    balance = newBalance;
    currentTerm = newTerm;
    month++;
  }

  // Calculate total payments based on schedule length
  const totalPayments = schedule.length;
  
  return { schedule, fixedInstallment, totalPayments };
};

// PRICE Simulation Function
export const simulatePrice = (principal, term, annualInterest, annualCorrection, insurance, extraAmortizations) => {
  const monthlyInterest = annualToMonthlyRate(annualInterest);
  const monthlyCorrection = annualToMonthlyRate(annualCorrection);
  const MAX_ITERATIONS = 1000;

  // Calculate initial installment for reference and use in first month
  // The installment will be recalculated each month considering monetary correction
  const correction1 = principal * monthlyCorrection;
  const correctedDebt1 = principal + correction1;
  
  // Price installment formula: P = PV * (i * (1 + i)^n) / ((1 + i)^n - 1)
  // Where: P = installment, PV = principal, i = interest rate, n = number of installments
  const initialInstallmentPrice = correctedDebt1 * (monthlyInterest * Math.pow(1 + monthlyInterest, term)) / (Math.pow(1 + monthlyInterest, term) - 1);
  const fixedInstallment = initialInstallmentPrice + insurance;

  // Initialize variables
  let balance = principal;
  let currentTerm = term;
  let month = 1;
  const schedule = [];
  let lastAmortMonth = 0;
  let currentInstallmentPrice = initialInstallmentPrice; // Initial value that will be recalculated each month

  while (balance > 0.01 && month <= MAX_ITERATIONS) {
    const correction = balance * monthlyCorrection;
    const correctedDebt = balance + correction;

    // Normally decrement remaining term
    if (month > 1) {
      if (month > lastAmortMonth) {
        currentTerm = currentTerm - 1;
      }
    }
    
    // Apply extra amortization
    // Get value and type of amortization for current month
    let extraAmort = 0;
    let amortType = "prazo";
    let autoGenerated = false;
    
    if (extraAmortizations[month]) {
      if (typeof extraAmortizations[month] === 'object') {
        extraAmort = extraAmortizations[month].value || 0;
        amortType = extraAmortizations[month].type || "prazo";
        autoGenerated = extraAmortizations[month].auto_generated || false;
      } else {
        // Compatibility with old format (just value, no type)
        extraAmort = extraAmortizations[month];
        amortType = "prazo";
        autoGenerated = false;
      }
    }
    
    // Calculate interest on corrected debt balance
    const interest = correctedDebt * monthlyInterest;
    
    // MAIN MODIFICATION: Recalculate the Price installment for the current month
    // based on the corrected balance and remaining term
    if (extraAmort === 0) { // Only recalculate if there's no extra amortization this month
      if (currentTerm > 0) {
        // Recalculate the Price installment for the remaining term and current corrected balance
        currentInstallmentPrice = correctedDebt * (monthlyInterest * Math.pow(1 + monthlyInterest, currentTerm)) / 
                               (Math.pow(1 + monthlyInterest, currentTerm) - 1);
      } else {
        // Last month, installment = balance + interest
        currentInstallmentPrice = correctedDebt * (1 + monthlyInterest);
      }
    }
    
    // In Price, amortization varies: fixed installment - interest
    let monthlyAmort = Math.min(currentInstallmentPrice - interest, correctedDebt);
    
    // If interest is higher than installment (rare but possible),
    // amortization would be negative, which doesn't make sense. In this case, limit to 0.
    monthlyAmort = Math.max(0, monthlyAmort);
    
    let totalAmort, newBalance, installment, newTerm, actualExtraAmort;
    
    if (extraAmort > 0) {
      lastAmortMonth = month;
      
      // Limit extra amortization to remaining balance after regular amortization
      const maxExtraAmort = correctedDebt - monthlyAmort;
      actualExtraAmort = Math.min(extraAmort, maxExtraAmort);
      
      // Apply extra amortization
      totalAmort = monthlyAmort + actualExtraAmort;
      newBalance = correctedDebt - totalAmort;
      
      // Different treatment based on amortization type
      if (amortType === "prazo") {
        // LOGIC FOR TERM REDUCTION
        // Keep current installment, recalculate term
        
        // If balance is very low, we may have reached the end of financing
        if (newBalance < 0.01) {
          newTerm = 0;
          installment = totalAmort + interest + insurance;
        } else {
          // Recalculate remaining term based on new balance and same installment
          // Using inverted Price formula: n = ln(P / (P - PV*i)) / ln(1+i)
          // Where: n = number of installments, P = installment, PV = principal, i = interest rate
          
          // Consider future monetary correction
          const nextCorrection = newBalance * monthlyCorrection;
          const nextCorrectedDebt = newBalance + nextCorrection;
          
          // Keep current installment (don't recalculate in this case)
          // Calculate new term based on current installment and new balance
          
          // Denominator must be positive for logarithm to be defined
          // This checks if payment is large enough to cover more than just interest
          if (currentInstallmentPrice > nextCorrectedDebt * monthlyInterest) {
            const numerator = currentInstallmentPrice;
            const denominator = currentInstallmentPrice - nextCorrectedDebt * monthlyInterest;
            if (denominator > 0) {
              const calculatedTerm = Math.log(numerator / denominator) / Math.log(1 + monthlyInterest);
              newTerm = Math.max(1, Math.ceil(calculatedTerm)); // Round up
            } else {
              // If denominator is negative, installment is not enough
              // to cover interest. Keep current term in this case (rare).
              newTerm = currentTerm;
            }
          } else {
            // If installment is less than interest, keep current term
            newTerm = currentTerm;
          }
          
          // Installment keeps original value (with insurance)
          installment = currentInstallmentPrice + insurance;
        }
      } else { // amortType === "parcela"
        // LOGIC FOR INSTALLMENT REDUCTION
        // Keep current term, decrease installment value
        newTerm = currentTerm;
        
        // If balance is very low, we may have reached the end of financing
        if (newBalance < 0.01) {
          installment = totalAmort + interest + insurance;
        } else {
          // Recalculate installment based on new balance and same term
          const nextCorrection = newBalance * monthlyCorrection;
          const nextCorrectedDebt = newBalance + nextCorrection;
          
          // Apply Price formula with new balance and same term
          if (newTerm > 0) {
            // Here we explicitly adjust the installment for the new balance
            const newInstallmentPrice = nextCorrectedDebt * (monthlyInterest * Math.pow(1 + monthlyInterest, newTerm)) / (Math.pow(1 + monthlyInterest, newTerm) - 1);
            currentInstallmentPrice = newInstallmentPrice; // Update installment for next months
            installment = newInstallmentPrice + insurance;
          } else {
            // Special case - last month
            installment = totalAmort + interest + insurance;
          }
        }
      }
    } else {
      // No extra amortization this month
      totalAmort = monthlyAmort;
      newBalance = correctedDebt - totalAmort;
      installment = currentInstallmentPrice + insurance;
      
      // Keep remaining term calculated previously
      newTerm = currentTerm;
      actualExtraAmort = 0; // No extra amortization
      
      // Note: The installment was already recalculated above before amortization calculation
      // to reflect the current month's monetary correction
    }

    // Adjustment for last payment
    if (newBalance < 0.01) {
      totalAmort = correctedDebt;
      const installmentFinal = totalAmort + interest + insurance;
      newBalance = 0.0;
      
      // Add record with last payment
      const row = {
        month,
        saldoDevedor: balance,
        correction,
        dividaCorrigida: correctedDebt,
        juros: interest,
        amortizacaoMensal: monthlyAmort,
        seguro: insurance,
        amortizacaoExtra: actualExtraAmort || 0,
        tipoAmortizacao: extraAmort > 0 ? amortType : "",
        autoGenerated,
        novoSaldo: newBalance,
        parcela: installmentFinal,
        prazoRemanescente: newTerm,
        parcelaPrice: currentInstallmentPrice // Store Price installment (without insurance)
      };
      schedule.push(row);
      break;
    } else {
      // Add current month's record
      const row = {
        month,
        saldoDevedor: balance,
        correction,
        dividaCorrigida: correctedDebt,
        juros: interest,
        amortizacaoMensal: monthlyAmort,
        seguro: insurance,
        amortizacaoExtra: actualExtraAmort || 0,
        tipoAmortizacao: extraAmort > 0 ? amortType : "",
        autoGenerated,
        novoSaldo: newBalance,
        parcela: installment,
        prazoRemanescente: newTerm,
        parcelaPrice: currentInstallmentPrice // Store Price installment (without insurance)
      };
      schedule.push(row);
    }

    balance = newBalance;
    currentTerm = newTerm;
    month++;
  }

  // Calculate total payments
  const totalPayments = schedule.length;
  
  // Use the first month's installment as initial reference
  // but note that the installment can vary over time due to monetary correction
  return { 
    schedule, 
    fixedInstallment: schedule[0]?.parcela || fixedInstallment, // Use real first month's installment
    totalPayments 
  };
};

// Target term optimization
export const calculateAmortizationForTargetTerm = (principal, initialTerm, targetTerm, annualInterest, annualCorrection, 
                                           insurance, amortizationMonths, system = "sac", amortType = "prazo", 
                                           maxIterations = 50, precision = 0.01) => {
  if (targetTerm >= initialTerm) {
    console.error("Target term must be less than initial term.");
    return { amortValue: 0, finalTerm: initialTerm };
  }
  
  // Configure amortization months format
  const amortizationConfig = {};
  for (const month of amortizationMonths) {
    amortizationConfig[month] = {
      value: 0, // Initial value will be adjusted during search
      type: amortType,
      auto_generated: true
    };
  }
  
  // Initialize limits for binary search
  let amortMin = 0.0;
  let amortMax = principal / Object.keys(expandAmortizationRanges(amortizationConfig)).length; // Theoretical maximum
  
  let bestAmort = 0.0;
  let bestTerm = initialTerm;
  
  // Simulation function to use based on chosen system
  const simulateFunc = system.toLowerCase() === "sac" ? simulateSac : simulatePrice;
  
  // Binary search to find ideal amortization value
  for (let i = 0; i < maxIterations; i++) {
    const currentAmort = (amortMin + amortMax) / 2;
    
    // Configure amortizations with current value
    for (const month in amortizationConfig) {
      amortizationConfig[month].value = currentAmort;
    }
    
    // Expand configuration to format compatible with simulator
    const extraAmortizations = expandAmortizationRanges(amortizationConfig);
    
    // Simulate financing with extra amortizations
    const { schedule, fixedInstallment, totalPayments } = simulateFunc(
      principal, initialTerm, annualInterest, annualCorrection, 
      insurance, extraAmortizations
    );
    
    const obtainedTerm = totalPayments;
    
    // Check if we've reached target term with desired precision
    if (Math.abs(obtainedTerm - targetTerm) <= precision) {
      return { amortValue: currentAmort, finalTerm: obtainedTerm };
    }
    
    // Adjust search limits
    if (obtainedTerm > targetTerm) {
      // Term is still too long, need to increase amortization
      amortMin = currentAmort;
    } else {
      // Term is too short, need to decrease amortization
      amortMax = currentAmort;
    }
    
    // Save best amortization found so far
    if (Math.abs(obtainedTerm - targetTerm) < Math.abs(bestTerm - targetTerm)) {
      bestAmort = currentAmort;
      bestTerm = obtainedTerm;
    }
  }
  
  return { amortValue: bestAmort, finalTerm: bestTerm };
};

// Calculate total savings
export const calculateTotalSavings = (baseResults, amortResults) => {
  console.log("Cálculo de economia - Sistema básico:", baseResults.system, "Prazo:", baseResults.totalPayments);
  console.log("Cálculo de economia - Com amortização:", amortResults.system, "Prazo:", amortResults.totalPayments);
  
  // Verificar se está comparando simulações com o mesmo sistema
  if (baseResults.system !== amortResults.system) {
    console.warn("AVISO: Comparando simulações com sistemas diferentes!");
  }
  
  // Interest savings - garantir que seja sempre positivo (ou zero)
  const jurosSavings = Math.max(0, baseResults.totalInterest - amortResults.totalInterest);
  console.log("Economia de juros:", jurosSavings, "(", baseResults.totalInterest, "-", amortResults.totalInterest, ")");
  
  // Insurance savings - garantir que seja sempre positivo (ou zero)
  const segurosSavings = Math.max(0, baseResults.totalInsurance - amortResults.totalInsurance);
  console.log("Economia de seguros:", segurosSavings, "(", baseResults.totalInsurance, "-", amortResults.totalInsurance, ")");
  
  // Monetary correction savings - garantir que seja sempre positivo (ou zero)
  const correcaoSavings = Math.max(0, baseResults.totalCorrection - amortResults.totalCorrection);
  console.log("Economia de correção:", correcaoSavings, "(", baseResults.totalCorrection, "-", amortResults.totalCorrection, ")");
  
  // Custo das amortizações extras
  const custoAmortizacoes = amortResults.totalExtraAmort || 0;
  console.log("Custo das amortizações extras:", custoAmortizacoes);
  
  // Total savings: a verdadeira economia é a soma da economia em juros, seguros e correção
  // Não devemos subtrair as amortizações extras, pois elas são apenas um adiantamento
  // do principal, que seria pago de qualquer forma
  const economiaTotal = jurosSavings + segurosSavings + correcaoSavings;
  const totalSavings = economiaTotal;
  
  console.log("Economia total (juros + seguros + correção):", economiaTotal);
  
  // Time saved - calcular corretamente
  // Em caso de amortização por redução de prazo, há economia de tempo
  // Em caso de amortização por redução de parcela, não há necessariamente economia de tempo
  let tempoEconomizado = baseResults.totalPayments - amortResults.totalPayments;
  
  // Verifica se a lista de amortizações tem pelo menos alguma do tipo 'prazo'
  // Se só tiver amortizações do tipo 'parcela', não deve mostrar economia de tempo
  const temAmortizacaoPrazo = amortResults.schedule.some(item => item.tipoAmortizacao === 'prazo');
  
  if (!temAmortizacaoPrazo) {
    // Se não houver amortização por prazo, não mostrar economia de tempo
    tempoEconomizado = 0;
  } else {
    // Garantir que o tempo economizado seja sempre positivo ou zero
    tempoEconomizado = Math.max(0, tempoEconomizado);
  }
  
  const tempoAnos = tempoEconomizado / 12;
  console.log("Tempo economizado em meses:", tempoEconomizado);
  
  return {
    juros: jurosSavings,
    seguros: segurosSavings,
    correcao: correcaoSavings,
    total: totalSavings,
    tempoMeses: tempoEconomizado,
    tempoAnos: tempoAnos.toFixed(1)
  };
};

// Calculate simulation summary
export const calculateSimulationSummary = (schedule, fixedInstallment, totalPayments, system = "sac") => {
  // Armazena o sistema usado para comparação futura
  const usedSystem = system.toLowerCase(); // Normaliza para evitar inconsistências de maiúsculas/minúsculas
  
  // Simulation summary
  const totalInterest = schedule.reduce((sum, row) => sum + row.juros, 0);
  const totalCorrection = schedule.reduce((sum, row) => sum + row.correction, 0);
  const totalInsurance = schedule.reduce((sum, row) => sum + row.seguro, 0);
  
  // Separate amortizations by type
  const totalExtraAmortPrazo = schedule.reduce((sum, row) => 
    sum + (row.tipoAmortizacao === 'prazo' ? row.amortizacaoExtra : 0), 0);
  const totalExtraAmortParcela = schedule.reduce((sum, row) => 
    sum + (row.tipoAmortizacao === 'parcela' ? row.amortizacaoExtra : 0), 0);
  const totalExtraAmort = totalExtraAmortPrazo + totalExtraAmortParcela;
  
  // O valor a ser pago é a soma de todas as parcelas (que já incluem amortização regular)
  // mais as amortizações extras (que são pagas adicionalmente)
  const totalPaid = schedule.reduce((sum, row) => sum + row.parcela, 0) + totalExtraAmort;
  
  console.log("Total de parcelas:", schedule.reduce((sum, row) => sum + row.parcela, 0));
  console.log("Total de amortizações extras:", totalExtraAmort);
  console.log("Total pago:", totalPaid);

  return {
    system: usedSystem, // Armazena o sistema normalizado
    totalPayments,
    totalInterest,
    totalCorrection,
    totalInsurance,
    totalExtraAmortPrazo,
    totalExtraAmortParcela,
    totalExtraAmort,
    totalPaid,
    firstInstallment: schedule[0]?.parcela || 0,
    lastInstallment: schedule[schedule.length - 1]?.parcela || 0,
    schedule
  };
};