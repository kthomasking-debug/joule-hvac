/**
 * CO2 Equivalency Calculator
 * Translates abstract CO2 numbers into tangible, human-scale comparisons
 * Based on EPA Greenhouse Gas Equivalencies Calculator
 */

/**
 * Calculate real-world equivalents for CO2 emissions (in pounds)
 * All equivalencies based on EPA GHG calculator methodologies
 * 
 * @param {number} co2Pounds - CO2 emissions in pounds
 * @returns {Object} Object containing various real-world equivalents
 */
export function calculateCO2Equivalents(co2Pounds) {
    // EPA conversion factors
    const MILES_PER_POUND_CO2 = 1.14;              // Average passenger vehicle miles per lb CO2
    const GALLONS_GAS_PER_POUND_CO2 = 0.051;        // Gallons of gasoline per lb CO2 (19.6 lbs CO2/gallon)
    const TREE_SEEDLINGS_PER_POUND_CO2 = 0.00747;   // Tree seedlings grown for 10 years per lb CO2
    const HOME_ELECTRICITY_DAYS_PER_POUND_CO2 = 0.0333; // Days of average home electricity per lb CO2
    const WASTE_RECYCLED_PER_POUND_CO2 = 1.73;      // Pounds of waste recycled instead of landfilled
    
    // Algae sequestration (open pond: ~20,000 lbs CO2 per acre per year)
    const ALGAE_SQ_FT_PER_POUND_CO2 = 2.18;         // Square feet of algae pond per lb CO2/year
    
    return {
        // Car miles not driven
        carMiles: co2Pounds * MILES_PER_POUND_CO2,
        
        // Gallons of gasoline not burned
        gallonsGas: co2Pounds * GALLONS_GAS_PER_POUND_CO2,
        
        // Tree seedlings grown for 10 years
        treeSeedlings: co2Pounds * TREE_SEEDLINGS_PER_POUND_CO2,
        
        // Days of home electricity avoided
        homeDays: co2Pounds * HOME_ELECTRICITY_DAYS_PER_POUND_CO2,
        
        // Pounds of waste recycled
        wasteRecycled: co2Pounds * WASTE_RECYCLED_PER_POUND_CO2,
        
        // Square feet of algae sequestration
        algaeSquareFeet: co2Pounds * ALGAE_SQ_FT_PER_POUND_CO2,
    };
}

/**
 * Format a single CO2 equivalent as a human-readable string
 * Chooses the most appropriate unit based on magnitude
 * 
 * @param {number} co2Pounds - CO2 emissions in pounds
 * @param {string} type - Type of equivalent ('car'|'gas'|'trees'|'electricity'|'recycling'|'algae')
 * @returns {string} Formatted equivalent string
 */
export function formatCO2Equivalent(co2Pounds, type = 'car') {
    const equivalents = calculateCO2Equivalents(co2Pounds);
    
    switch (type) {
        case 'car': {
            const miles = equivalents.carMiles;
            if (miles < 100) {
                return `${Math.round(miles)} miles of driving`;
            } else if (miles < 1000) {
                return `${Math.round(miles)} miles of driving`;
            } else {
                return `${(miles / 1000).toFixed(1)}k miles of driving`;
            }
        }
        
        case 'gas': {
            const gallons = equivalents.gallonsGas;
            return `${Math.round(gallons)} gallons of gasoline`;
        }
        
        case 'trees': {
            const trees = equivalents.treeSeedlings;
            return `${Math.round(trees)} tree seedlings (10-year growth)`;
        }
        
        case 'electricity': {
            const days = equivalents.homeDays;
            if (days < 7) {
                return `${Math.round(days)} days of home electricity`;
            } else if (days < 60) {
                const weeks = Math.round(days / 7);
                return `${weeks} week${weeks !== 1 ? 's' : ''} of home electricity`;
            } else {
                const months = Math.round(days / 30);
                return `${months} month${months !== 1 ? 's' : ''} of home electricity`;
            }
        }
        
        case 'recycling': {
            const waste = equivalents.wasteRecycled;
            if (waste < 1000) {
                return `${Math.round(waste)} lbs of waste recycled`;
            } else {
                return `${(waste / 2000).toFixed(1)} tons of waste recycled`;
            }
        }
        
        case 'algae': {
            const sqft = equivalents.algaeSquareFeet;
            if (sqft < 500) {
                return `${Math.round(sqft)} sq ft of algae`;
            } else if (sqft < 5000) {
                // Convert to comparison objects
                const tennisCourts = sqft / 2808; // Tennis court is 2,808 sq ft
                if (tennisCourts > 0.8) {
                    return `${tennisCourts.toFixed(1)} tennis court${tennisCourts >= 1.5 ? 's' : ''} of algae`;
                }
                return `${Math.round(sqft).toLocaleString()} sq ft of algae`;
            } else {
                const acres = sqft / 43560;
                return `${acres.toFixed(2)} acre${acres >= 1.5 ? 's' : ''} of algae`;
            }
        }
        
        default:
            return formatCO2Equivalent(co2Pounds, 'car');
    }
}

/**
 * Get the best single equivalent for display
 * Chooses the most impactful comparison based on magnitude
 * 
 * @param {number} co2Pounds - CO2 emissions in pounds
 * @returns {Object} Object with { text, icon, type }
 */
export function getBestEquivalent(co2Pounds) {
    const equivalents = calculateCO2Equivalents(co2Pounds);
    
    // For small amounts (< 100 lbs): show miles or days
    if (co2Pounds < 100) {
        if (equivalents.carMiles > 20) {
            return {
                text: formatCO2Equivalent(co2Pounds, 'car'),
                icon: '🚗',
                type: 'car'
            };
        } else {
            return {
                text: formatCO2Equivalent(co2Pounds, 'electricity'),
                icon: '💡',
                type: 'electricity'
            };
        }
    }
    
    // For medium amounts (100-1000 lbs): show car miles or trees
    if (co2Pounds < 1000) {
        if (equivalents.carMiles > 100) {
            return {
                text: formatCO2Equivalent(co2Pounds, 'car'),
                icon: '🚗',
                type: 'car'
            };
        } else {
            return {
                text: formatCO2Equivalent(co2Pounds, 'trees'),
                icon: '🌳',
                type: 'trees'
            };
        }
    }
    
    // For large amounts (> 1000 lbs): show car miles (most relatable)
    return {
        text: formatCO2Equivalent(co2Pounds, 'car'),
        icon: '🚗',
        type: 'car'
    };
}

/**
 * Get multiple equivalents for tooltip/detailed view
 * Returns top 3 most relevant comparisons
 * 
 * @param {number} co2Pounds - CO2 emissions in pounds
 * @returns {Array} Array of { text, icon, type } objects
 */
export function getMultipleEquivalents(co2Pounds) {
    const equivalents = calculateCO2Equivalents(co2Pounds);
    const results = [];
    
    // Always include car miles (most universal)
    if (equivalents.carMiles > 10) {
        results.push({
            text: formatCO2Equivalent(co2Pounds, 'car'),
            icon: '🚗',
            type: 'car'
        });
    }
    
    // Include trees if meaningful (> 1 tree)
    if (equivalents.treeSeedlings >= 1) {
        results.push({
            text: formatCO2Equivalent(co2Pounds, 'trees'),
            icon: '🌳',
            type: 'trees'
        });
    }
    
    // Include electricity if meaningful (> 1 day)
    if (equivalents.homeDays >= 1) {
        results.push({
            text: formatCO2Equivalent(co2Pounds, 'electricity'),
            icon: '💡',
            type: 'electricity'
        });
    }
    
    // Include algae for larger amounts (tennis court size is compelling)
    if (equivalents.algaeSquareFeet > 1000) {
        results.push({
            text: formatCO2Equivalent(co2Pounds, 'algae'),
            icon: '🌿',
            type: 'algae'
        });
    }
    
    // Return top 3 most impactful
    return results.slice(0, 3);
}

/**
 * Format annual CO2 savings with context
 * Special formatting for yearly reductions (used in ROI/upgrade comparisons)
 * 
 * @param {number} annualPoundsReduced - Annual CO2 reduction in pounds
 * @returns {string} Formatted string with compelling comparison
 */
export function formatAnnualReduction(annualPoundsReduced) {
    const equivalents = calculateCO2Equivalents(annualPoundsReduced);
    
    // For annual savings, miles of driving is most compelling
    const miles = equivalents.carMiles;
    
    if (miles < 1000) {
        return `${Math.round(miles)} miles of driving per year`;
    } else if (miles < 10000) {
        return `${(miles / 1000).toFixed(1)}k miles of driving per year`;
    } else {
        // Put in perspective of daily commute
        const milesPerDay = miles / 365;
        const roundTripCommute = Math.round(milesPerDay);
        return `a ${roundTripCommute}-mile daily commute for a year`;
    }
}
