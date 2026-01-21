# RAG Equipment Data Ingestion Guide

## Overview

This guide explains how to ingest manufacturer equipment data into the RAG knowledge base to answer specific technical questions about HVAC equipment models, specifications, installation requirements, troubleshooting, and compatibility.

## Current Status

The knowledge base structure is ready to receive equipment data. The framework includes:

- Equipment specifications (HSPF2, SEER2, COP, capacity, airflow, refrigerants)
- Installation requirements (clearances, line sets, electrical, gas, dual-fuel)
- Troubleshooting (fault codes, diagnostic procedures)
- Compatibility (AHRI matching, approved combinations)
- Sizing support (Manual J/S/D guidance)
- Energy efficiency (tax credits, ENERGY STAR, DOE regulations)
- Parts & replacement (part numbers, supersessions)

## Data Sources to Ingest

### 1. Technical Specifications

**Manufacturer Submittal Sheets / Data Sheets**

- Format: PDF, typically 2-10 pages per model
- Contains: HSPF2, SEER2, COP at various temps, capacity curves, airflow, static pressure, sound levels
- Brands: Carrier, Trane, Lennox, Daikin, Mitsubishi, Fujitsu, LG, Samsung, Bosch, Gree, Midea, Rheem/Ruud, York, Goodman/Amana, Bryant, American Standard, Nordyne, Payne, Heil, Tempstar, Comfortmaker, Arcoaire, KeepRite

**AHRI Certificates**

- Format: CSV/JSON database (~15-20 GB unpacked)
- Contains: Certified performance for matched systems, AHRI numbers, SEER2/HSPF2 ratings
- Source: AHRI Directory (full database)

**Product Data / Specification Catalogs**

- Format: PDF catalogs, 50-500 pages each
- Contains: Complete model lines, specifications, performance data
- Updated: Annually or when new models released

**Expanded Performance Data Tables**

- Format: PDF tables, Excel spreadsheets
- Contains: Capacity and COP at multiple outdoor temperatures (47°F, 17°F, 5°F, -15°F)

### 2. Installation Requirements

**Installation, Operation & Maintenance (IOM) Manuals**

- Format: PDF, typically 20-100 pages
- Contains: Clearances, line-set requirements, electrical specs, gas requirements, drain requirements
- Updated: With each model generation

**Installer's Guides / Installation Instructions**

- Format: PDF, typically 10-50 pages
- Contains: Step-by-step installation procedures, requirements, code references
- Brand-specific: Each manufacturer has unique format

**Accessory Catalogs**

- Format: PDF
- Contains: Line-set sizing charts, dual-fuel kits, installation accessories

**Code References**

- IMC (International Mechanical Code)
- IRC (International Residential Code)
- NFPA 54 (National Fuel Gas Code)
- NEC (National Electrical Code)

### 3. Troubleshooting & Fault Codes

**Service Manuals / Service Facts**

- Format: PDF, typically 50-200 pages
- Contains: Complete fault code lists, diagnostic procedures, component testing
- Brands: Trane/American Standard, Carrier, Lennox, Goodman, etc.

**Fault Code Guides**

- Format: PDF booklets, 10-50 pages
- Contains: Quick reference for fault codes, causes, solutions
- Updated: With firmware/software updates

**Technical Service Bulletins (TSBs)**

- Format: PDF, typically 1-10 pages each
- Contains: Known issues, updated procedures, part supersessions
- Updated: Continuously as issues are discovered

**Field Service Guides**

- Format: PDF, typically 100-500 pages
- Contains: Comprehensive troubleshooting procedures for all components

### 4. Compatibility & Matching

**AHRI Directory (Full Database)**

- Format: CSV/JSON, ~15-20 GB unpacked
- Contains: All certified matched combinations, AHRI numbers, performance ratings
- Updated: Continuously as new combinations are certified

**Manufacturer Matching Tables**

- Format: PDF, Excel, or web-based
- Contains: Approved outdoor/indoor coil combinations for each model
- Updated: With new model releases

**Product Data "Allowed Combinations" Sections**

- Format: Embedded in product catalogs
- Contains: Specific approved pairings with part numbers

### 5. Sizing & Load Calculation

**ACCA Manual J/S/D Excerpts**

- Format: PDF excerpts, examples
- Contains: Load calculation methodology, sizing rules, examples

**Manufacturer Sizing Guides**

- Format: PDF, web tools
- Contains: Brand-specific sizing recommendations, examples
- Tools: Carrier HAP exports, Wrightsoft tables, CoolCalc outputs

**NEEP Cold-Climate Heat Pump List (ccASHP)**

- Format: CSV, updated quarterly
- Contains: Capacity at 5°F for certified cold-climate models
- Source: NEEP (Northeast Energy Efficiency Partnerships)

### 6. Energy Efficiency & Regulatory

**ENERGY STAR Product Lists**

- Format: CSV, JSON, web API
- Contains: All ENERGY STAR certified models, efficiency ratings
- Updated: Monthly

**CEE (Consortium for Energy Efficiency) Tier Lists**

- Format: PDF, CSV
- Contains: Efficiency tiers for rebate programs
- Updated: Annually

**IRS 25C Qualified Product Database**

- Format: CSV, web database
- Contains: Products qualifying for $2,000 federal tax credit
- Updated: As new products are certified

**DOE Regulatory Documents**

- Format: PDF regulations, compliance certificates
- Contains: Minimum efficiency standards, regional requirements, compliance dates

### 7. Parts & Replacement

**Parts Catalogs / Replacement Component Guides**

- Format: PDF, web-based parts finders
- Contains: Complete parts lists with part numbers, descriptions, prices
- Updated: Continuously as parts are added/discontinued

**Supersession Tables**

- Format: Excel, CSV, PDF
- Contains: Old part number → new part number mappings
- Updated: When parts are superseded

## Ingestion Strategy

### Phase 1: Structure & Framework (✅ COMPLETE)

- Knowledge base structure created
- RAG search functions ready
- Trigger keywords configured

### Phase 2: Example Data (In Progress)

- Add example entries for 2-3 popular models
- Show format for specifications, installation, troubleshooting
- Verify RAG can retrieve and cite correctly

### Phase 3: Bulk Ingestion

- Scrape/ingest manufacturer PDFs
- Parse AHRI Directory
- Index service manuals and fault code guides
- Process ENERGY STAR and tax credit databases

### Phase 4: Continuous Updates

- Set up automated ingestion for new models
- Monitor manufacturer websites for updates
- Update TSBs and service bulletins regularly
- Refresh ENERGY STAR and regulatory data

## Data Format for Knowledge Base

### Equipment Specifications Example

```javascript
equipmentSpecs: {
  models: {
    "Carrier-Infinity-19VS": {
      manufacturer: "Carrier",
      model: "Infinity 19VS",
      type: "Heat Pump",
      specifications: {
        seer2: 19.5,
        hspf2: 10.5,
        cop: {
          "47F": 4.2,
          "17F": 2.8,
          "5F": 2.1,
          "-15F": 1.5
        },
        capacity: {
          "47F": 36000, // BTU/hr
          "17F": 28000,
          "5F": 22000,
          "-15F": 16000
        },
        airflow: {
          min: 1200, // CFM
          max: 1800
        },
        staticPressure: {
          max: 0.6 // inches WC
        },
        refrigerant: {
          type: "R-410A",
          charge: 8.5 // lbs
        },
        soundLevel: {
          "low": 52, // dB(A)
          "medium": 58,
          "high": 65
        }
      },
      ahriNumbers: ["12345678", "12345679"],
      source: "Carrier Product Data Sheet 2024",
      lastUpdated: "2024-01-15"
    }
  }
}
```

### Installation Requirements Example

```javascript
installationRequirements: {
  models: {
    "Carrier-Infinity-19VS": {
      clearances: {
        outdoor: {
          sides: 12, // inches
          rear: 12,
          service: 36
        },
        indoor: {
          sides: 6,
          service: 30
        }
      },
      lineSet: {
        maxLength: 100, // feet
        maxVerticalRise: 80, // feet
        minLength: 25,
        liquidLine: "3/8\"",
        suctionLine: "5/8\""
      },
      electrical: {
        voltage: "208/230V",
        mca: 25, // amps
        mop: 35, // amps
        phase: "single"
      },
      dualFuel: {
        compatible: true,
        approvedFurnaces: ["Carrier-Infinity-80", "Carrier-Infinity-96"],
        switchoverTemp: 35 // °F
      },
      drain: {
        primaryRequired: true,
        auxiliaryRequired: true, // in attics
        panSize: "20x24 inches"
      },
      source: "Carrier IOM Manual 2024",
      lastUpdated: "2024-01-15"
    }
  }
}
```

### Troubleshooting Example

```javascript
troubleshooting: {
  faultCodes: {
    "Carrier": {
      "E1": {
        meaning: "Indoor temperature sensor fault",
        causes: ["Sensor disconnected", "Sensor shorted", "Sensor out of range"],
        solution: "Check sensor wiring, replace if faulty",
        source: "Carrier Service Manual 2024"
      },
      "E5": {
        meaning: "Communication error between indoor and outdoor units",
        causes: ["Loose connection", "Damaged wire", "Control board fault"],
        solution: "Check communication wire, verify connections",
        source: "Carrier Service Manual 2024"
      }
    },
    "Trane": {
      "5 flashes": {
        meaning: "Low pressure switch open",
        causes: ["Low refrigerant", "Restriction", "Faulty switch"],
        solution: "Check refrigerant charge, verify switch operation",
        source: "Trane Service Facts 2024"
      }
    }
  }
}
```

## Implementation Steps

### Step 1: Create Data Parser

Create `src/utils/rag/equipmentDataParser.js`:

- Parse PDF submittal sheets (extract tables, specifications)
- Parse AHRI Directory CSV/JSON
- Extract fault codes from service manuals
- Parse matching tables from manufacturer catalogs

### Step 2: Create Ingestion Script

Create `scripts/ingestEquipmentData.js`:

- Scrape manufacturer websites for PDFs
- Download AHRI Directory
- Process and normalize data
- Store in knowledge base format

### Step 3: Update RAG Search

Enhance `src/utils/rag/hvacKnowledgeBase.js`:

- Add model-specific search
- Match user questions to specific models
- Retrieve and format equipment data

### Step 4: Add Citation System

- Include source document name
- Include page numbers when available
- Include last updated date
- Include AHRI number for performance data

## Testing Protocol

After ingestion, test with questions like:

1. "What is the HSPF2 of Carrier Infinity 19VS at 5°F?"
2. "What are the electrical requirements for Trane XV18?"
3. "What does fault code E5 mean on a Carrier unit?"
4. "Is Lennox EL18XPV compatible with variable-speed furnace?"
5. "Does Mitsubishi PUMY-P36NKMU2 qualify for 25C tax credit?"

Expected: Responses should cite specific source documents and include exact specifications.

## Estimated Data Volume

- Manufacturer submittals: ~5,000 models × 5 pages = 25,000 pages
- AHRI Directory: ~15-20 GB (millions of combinations)
- Service manuals: ~500 models × 100 pages = 50,000 pages
- IOM manuals: ~500 models × 50 pages = 25,000 pages
- **Total: ~100,000+ pages, 20+ GB of structured data**

## Next Steps

1. ✅ Knowledge base structure created
2. ⏳ Add example entries (2-3 models)
3. ⏳ Create data parser
4. ⏳ Set up ingestion pipeline
5. ⏳ Begin bulk ingestion
6. ⏳ Set up continuous updates
