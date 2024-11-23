'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'
import * as d3 from 'd3';

// Extend the jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const standardMaterials = {
  'ASTM A36 Structural Steel': {
    yieldStrength: 250,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'ASTM A992 Structural Steel': {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'ASTM A572 Grade 50 Steel': {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'Custom': {
    yieldStrength: 0,
    elasticModulus: 0,
    density: 0,
    poissonsRatio: 0,
    thermalExpansion: 0,
  },
} as const;

interface BeamDiagramProps {
  beamLength: number;
  leftSupport: number;
  rightSupport: number;
  loadType: string;
  loadStartPosition: number;
  loadEndPosition: number;
  loadMagnitude: number;
}

const BeamDiagram: React.FC<BeamDiagramProps> = ({ 
  beamLength, 
  leftSupport, 
  rightSupport, 
  loadType, 
  loadStartPosition, 
  loadEndPosition, 
  loadMagnitude 
}) => {
  const svgWidth = 500
  const svgHeight = 200
  const margin = 40
  const beamY = svgHeight / 2
  const supportSize = 30

  const leftSupportX = margin + (leftSupport / beamLength) * (svgWidth - 2 * margin)
  const rightSupportX = margin + (rightSupport / beamLength) * (svgWidth - 2 * margin)

  const loadStartX = margin + (loadStartPosition / beamLength) * (svgWidth - 2 * margin)
  const loadEndX = margin + (loadEndPosition / beamLength) * (svgWidth - 2 * margin)

  return (
    <svg width={svgWidth} height={svgHeight} className="mx-auto">
      {/* Beam */}
      <line
        x1={margin}
        y1={beamY}
        x2={svgWidth - margin}
        y2={beamY}
        stroke="black"
        strokeWidth="4"
      />

      {/* Left Support */}
      <polygon
        points={`${leftSupportX},${beamY} ${leftSupportX - supportSize / 2},${
          beamY + supportSize
        } ${leftSupportX + supportSize / 2},${beamY + supportSize}`}
        fill="none"
        stroke="black"
        strokeWidth="2"
      />

      {/* Right Support */}
      <polygon
        points={`${rightSupportX},${beamY} ${rightSupportX - supportSize / 2},${
          beamY + supportSize
        } ${rightSupportX + supportSize / 2},${beamY + supportSize}`}
        fill="none"
        stroke="black"
        strokeWidth="2"
      />

      {/* Load Arrow(s) */}
      {loadType === 'Point Load' ? (
        <line
          x1={loadStartX}
          y1={beamY - 60}
          x2={loadStartX}
          y2={beamY}
          stroke="red"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      ) : (
        <>
          <line
            x1={loadStartX}
            y1={beamY - 40}
            x2={loadEndX}
            y2={beamY - 40}
            stroke="red"
            strokeWidth="2"
          />
          {Array.from({ length: 5 }).map((_, index) => {
            const x = loadStartX + ((loadEndX - loadStartX) / 4) * index
            return (
              <line
                key={index}
                x1={x}
                y1={beamY - 40}
                x2={x}
                y2={beamY}
                stroke="red"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            )
          })}
        </>
      )}

      {/* Arrow definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="0"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="red" />
        </marker>
      </defs>

      {/* Labels */}
      <text x={margin} y={beamY + supportSize + 20} textAnchor="middle" fontSize="12">
        0
      </text>
      <text x={svgWidth - margin} y={beamY + supportSize + 20} textAnchor="middle" fontSize="12">
        {beamLength}
      </text>
      <text x={(loadStartX + loadEndX) / 2} y={beamY - 70} textAnchor="middle" fontSize="12" fill="red">
        {loadMagnitude.toFixed(2)} N
      </text>
      <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle" fontSize="12">
        Beam Length: {beamLength} mm
      </text>
    </svg>
  )
}

export function BeamLoadCalculatorComponent() {
  const [beamType, setBeamType] = useState('Simple Beam')
  const [beamCrossSection, setBeamCrossSection] = useState('Rectangular')
  const [beamLength, setBeamLength] = useState(1000)
  const [leftSupport, setLeftSupport] = useState(0)
  const [rightSupport, setRightSupport] = useState(1000)
  const [loadType, setLoadType] = useState('Point Load')
  const [loadMagnitude, setLoadMagnitude] = useState(1000)
  const [loadStartPosition, setLoadStartPosition] = useState(500)
  const [loadEndPosition, setLoadEndPosition] = useState(500)
  const [shearForceData, setShearForceData] = useState<Array<{ x: number; y: number }>>([])
  const [bendingMomentData, setBendingMomentData] = useState<Array<{ x: number; y: number }>>([])
  const [material, setMaterial] = useState<keyof typeof standardMaterials>('ASTM A36 Structural Steel')
  const [customMaterial, setCustomMaterial] = useState<{ yieldStrength: number; elasticModulus: number }>(
    standardMaterials['Custom']
  );
  
  const [width, setWidth] = useState(100)
  const [height, setHeight] = useState(200)
  const [flangeWidth, setFlangeWidth] = useState(100)
  const [flangeThickness, setFlangeThickness] = useState(10)
  const [webThickness, setWebThickness] = useState(6)
  const [diameter, setDiameter] = useState(100)
  const [beamDensity, setBeamDensity] = useState(7850) // Default density for steel (kg/m³)
  const [beamWeight, setBeamWeight] = useState(0)
  const [results, setResults] = useState({
    maxShearForce: 0,
    maxBendingMoment: 0,
    maxNormalStress: 0,
    maxShearStress: 0,
    safetyFactor: 0,
    centerOfGravity: 0,
    momentOfInertia: 0,
    sectionModulus: 0,
  })

  const calculateResults = useCallback(() => {
    const newShearForceData: Array<{ x: number; y: number }> = []
    const newBendingMomentData: Array<{ x: number; y: number }> = []
    let maxShearForce = 0
    let maxBendingMoment = 0

    // Convert mm to m for calculations
    const beamLengthM = beamLength / 1000
    const leftSupportM = leftSupport / 1000
    const rightSupportM = rightSupport / 1000
    const loadStartPositionM = loadStartPosition / 1000
    const loadEndPositionM = loadEndPosition / 1000
    const widthM = width / 1000
    const heightM = height / 1000
    const flangeWidthM = flangeWidth / 1000
    const flangeThicknessM = flangeThickness / 1000
    const webThicknessM = webThickness / 1000
    const diameterM = diameter / 1000

    // Calculate beam weight
    let beamVolume: number
    switch (beamCrossSection) {
      case 'Rectangular':
        beamVolume = widthM * heightM * beamLengthM
        break
      case 'I Beam':
        beamVolume = (2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM) * beamLengthM
        break
      case 'C Channel':
        beamVolume = (2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM) * beamLengthM
        break
      case 'Circular':
        beamVolume = Math.PI * Math.pow(diameterM / 2, 2) * beamLengthM
        break
      default:
        beamVolume = widthM * heightM * beamLengthM
    }
    const beamWeightN = beamVolume * beamDensity * 9.81 // Convert kg to N
    setBeamWeight(Number(beamWeightN.toFixed(2)))

    // Calculate center of gravity
    let totalMoment = beamWeightN * (beamLengthM / 2) // Beam's moment about left end
    let totalForce = beamWeightN

    if (loadType === 'Point Load') {
      totalMoment += loadMagnitude * loadStartPositionM
      totalForce += loadMagnitude
    } else if (loadType === 'Uniform Load') {
      const loadLength = loadEndPositionM - loadStartPositionM
      const totalLoad = loadMagnitude * loadLength
      totalMoment += totalLoad * (loadStartPositionM + loadLength / 2)
      totalForce += totalLoad
    }

    const centerOfGravity = totalMoment / totalForce

    // Calculate results
    setShearForceData(newShearForceData)
    setBendingMomentData(newBendingMomentData)

    const materialProps = material === 'Custom' ? customMaterial : standardMaterials[material]
    let area: number, momentOfInertia: number, sectionModulus: number

    switch (beamCrossSection) {
      case 'Rectangular':
        area = widthM * heightM
        momentOfInertia = (widthM * Math.pow(heightM, 3)) / 12
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case 'I Beam':
        area = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        const I_flange = (flangeWidthM * Math.pow(flangeThicknessM, 3)) / 6 + 2 * flangeWidthM * flangeThicknessM * Math.pow((heightM - flangeThicknessM) / 2, 2)
        const I_web = (webThicknessM * Math.pow(heightM - 2 * flangeThicknessM, 3)) / 12
        momentOfInertia = 2 * I_flange + I_web
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case 'C Channel':
        area = 2 * flangeWidthM * flangeThicknessM + (heightM - 2 * flangeThicknessM) * webThicknessM
        const I_flange_c = (flangeWidthM * Math.pow(flangeThicknessM, 3)) / 12 + flangeWidthM * flangeThicknessM * Math.pow((heightM - flangeThicknessM) / 2, 2)
        const I_web_c = (webThicknessM * Math.pow(heightM - 2 * flangeThicknessM, 3)) / 12
        momentOfInertia = 2 * I_flange_c + I_web_c
        sectionModulus = momentOfInertia / (heightM / 2)
        break
      case 'Circular':
        area = Math.PI * Math.pow(diameterM / 2, 2)
        momentOfInertia = (Math.PI * Math.pow(diameterM, 4)) / 64
        sectionModulus = momentOfInertia / (diameterM / 2)
        break
      default:
        area = widthM * heightM
        momentOfInertia = (widthM * Math.pow(heightM, 3)) / 12
        sectionModulus = momentOfInertia / (heightM / 2)
    }

    const maxNormalStress = (maxBendingMoment / sectionModulus) / 1e6 // Convert to MPa
    const maxShearStress = (1.5 * maxShearForce / area) / 1e6 // Convert to MPa

    setResults({
      maxShearForce: Number(maxShearForce.toFixed(2)),
      maxBendingMoment: Number(maxBendingMoment.toFixed(2)),
      maxNormalStress: Number(maxNormalStress.toFixed(2)),
      maxShearStress: Number(maxShearStress.toFixed(2)),
      safetyFactor: Number((materialProps.yieldStrength / maxNormalStress).toFixed(2)),
      centerOfGravity: Number(centerOfGravity.toFixed(3)),
      momentOfInertia: Number(momentOfInertia.toFixed(6)),
      sectionModulus: Number(sectionModulus.toFixed(6)),
    })
  }, [beamType, beamCrossSection, beamLength, leftSupport, rightSupport, loadType, loadMagnitude, loadStartPosition, loadEndPosition, material, customMaterial, width, height, flangeWidth, flangeThickness, webThickness, diameter, beamDensity])

  const calculateDiagrams = () => {
    const numPoints = 100;
    const dx = beamLength / (numPoints - 1);
    const shearForce = [];
    const bendingMoment = [];

    for (let i = 0; i < numPoints; i++) {
      const x = i * dx;
      let shear = 0;
      let moment = 0;

      // Calculate reaction forces
      let R1 = 0;
      let R2 = 0;

      if (beamType === 'Simple Beam') {
        if (loadType === 'Point Load') {
          R1 = loadMagnitude * (rightSupport - loadStartPosition) / (rightSupport - leftSupport);
          R2 = loadMagnitude * (loadStartPosition - leftSupport) / (rightSupport - leftSupport);
        } else if (loadType === 'Uniform Load') {
          const loadLength = loadEndPosition - loadStartPosition;
          const totalLoad = loadMagnitude * loadLength;
          const loadCentroid = (loadStartPosition + loadEndPosition) / 2;
          R1 = totalLoad * (rightSupport - loadCentroid) / (rightSupport - leftSupport);
          R2 = totalLoad * (loadCentroid - leftSupport) / (rightSupport - leftSupport);
        }
      } else if (beamType === 'Cantilever Beam') {
        if (loadType === 'Point Load') {
          R1 = loadMagnitude;
        } else if (loadType === 'Uniform Load') {
          const loadLength = loadEndPosition - loadStartPosition;
          R1 = loadMagnitude * loadLength;
        }
      }

      // Calculate shear force and bending moment
      if (beamType === 'Simple Beam') {
        if (x >= leftSupport) shear += R1;
        if (x >= rightSupport) shear -= R2;

        if (loadType === 'Point Load' && x >= loadStartPosition) {
          shear -= loadMagnitude;
        } else if (loadType === 'Uniform Load' && x >= loadStartPosition) {
          const loadedLength = Math.min(x - loadStartPosition, loadEndPosition - loadStartPosition);
          shear -= loadMagnitude * loadedLength;
        }

        moment = R1 * (x - leftSupport);
        if (x > rightSupport) moment -= R2 * (x - rightSupport);

        if (loadType === 'Point Load' && x > loadStartPosition) {
          moment -= loadMagnitude * (x - loadStartPosition);
        } else if (loadType === 'Uniform Load' && x > loadStartPosition) {
          const loadedLength = Math.min(x - loadStartPosition, loadEndPosition - loadStartPosition);
          const loadCentroid = loadStartPosition + loadedLength / 2;
          moment -= loadMagnitude * loadedLength * (x - loadCentroid);
        }
      } else if (beamType === 'Cantilever Beam') {
        if (loadType === 'Point Load') {
          if (x <= loadStartPosition) {
            shear = -loadMagnitude;
            moment = -loadMagnitude * (beamLength - loadStartPosition);
          } else {
            shear = 0;
            moment = 0;
          }
        } else if (loadType === 'Uniform Load') {
          const loadLength = loadEndPosition - loadStartPosition;
          if (x <= loadStartPosition) {
            shear = -loadMagnitude * loadLength;
            moment = -loadMagnitude * loadLength * (beamLength - (loadStartPosition + loadEndPosition) / 2);
          } else if (x > loadStartPosition && x < loadEndPosition) {
            const remainingLength = loadEndPosition - x;
            shear = -loadMagnitude * remainingLength;
            moment = -loadMagnitude * remainingLength * remainingLength / 2;
          } else {
            shear = 0;
            moment = 0;
          }
        }
      }

      shearForce.push({ x: Number(x.toFixed(2)), y: Number(shear.toFixed(2)) });
      bendingMoment.push({ x: Number(x.toFixed(2)), y: Number(moment.toFixed(2)) });
    }

    setShearForceData(shearForce);
    setBendingMomentData(bendingMoment);
  };

  useEffect(() => {
    calculateResults();
    calculateDiagrams();
  }, [calculateResults, beamType, beamLength, leftSupport, rightSupport, loadType, loadMagnitude, loadStartPosition, loadEndPosition]);

  const handleDownloadPDF = async () => {
    try {
      console.log('Starting PDF generation');
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Helper function to add text with automatic line breaks
      const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
        const lines = pdf.splitTextToSize(text, maxWidth);
        pdf.text(lines, x, y);
        return y + (lines.length * lineHeight);
      };

      console.log('Adding title and date');
      // Title
      pdf.setFontSize(18);
      pdf.text('Beam Analysis Report', pageWidth / 2, 20, { align: 'center' });
      
      // Date
      pdf.setFontSize(12);
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      pdf.text(`Date: ${date}`, pageWidth / 2, 30, { align: 'center' });
      
      // Enhanced Load Calculator
      pdf.setFontSize(14);
      pdf.text('Enhanced Load Calculator', pageWidth / 2, 40, { align: 'center' });

      let yOffset = 60;

      console.log('Adding beam configuration');
      // 1. Beam Configuration
      pdf.setFontSize(14);
      pdf.text('1. Beam Configuration', margin, yOffset);
      yOffset += 10;
      pdf.setFontSize(12);
      yOffset = addWrappedText(`Type: ${beamType}`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`Length: ${beamLength} mm`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`Material: ${material}`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`Cross Section: ${beamCrossSection}`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset += 10;

      console.log('Adding applied loads');
      // 2. Applied Loads
      pdf.setFontSize(14);
      pdf.text('2. Applied Loads', margin, yOffset);
      yOffset += 10;
      pdf.setFontSize(12);
      yOffset = addWrappedText(`Load 1:`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`  • Type: ${loadType.toLowerCase()}`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`  • Force: ${loadMagnitude.toFixed(2)}N`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset = addWrappedText(`  • Distance: ${loadStartPosition.toFixed(2)} mm`, margin, yOffset, pageWidth - 2 * margin, 6);
      if (loadType === 'Uniform Load') {
        yOffset = addWrappedText(`  • End Distance: ${loadEndPosition.toFixed(2)} mm`, margin, yOffset, pageWidth - 2 * margin, 6);
      }
      yOffset = addWrappedText(`  • Angle: 90°`, margin, yOffset, pageWidth - 2 * margin, 6);
      yOffset += 10;

      console.log('Adding analysis results');
      // 3. Analysis Results
      pdf.setFontSize(14);
      pdf.text('3. Analysis Results', margin, yOffset);
      yOffset += 10;
      pdf.setFontSize(12);
      
      pdf.autoTable({
        head: [['Parameter', 'Value', 'Unit']],
        body: [
          ['Resultant Force', loadMagnitude.toFixed(2), 'N'],
          ['Resultant Angle', '90.00', '°'],
          ['Max Shear Force', results.maxShearForce.toFixed(2), 'N'],
          ['Max Bending Moment', results.maxBendingMoment.toFixed(2), 'N·mm'],
          ['Max Normal Stress', results.maxNormalStress.toFixed(2), 'MPa'],
          ['Max Shear Stress', results.maxShearStress.toFixed(2), 'MPa'],
          ['Max Deflection', '0.00', 'mm'],
          ['Safety Factor', results.safetyFactor.toFixed(2), '-'],
          ['Beam Weight', beamWeight.toFixed(2), 'N'],
        ],
        startY: yOffset,
        margin: { left: margin },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 60 },
          2: { cellWidth: 30 },
        },
      });

      yOffset = (pdf as any).lastAutoTable.finalY + 10;

      console.log('Adding force diagrams');
      // 4. Force Diagrams
      pdf.addPage();
      yOffset = 20;
      pdf.setFontSize(14);
      pdf.text('4. Force Diagrams', margin, yOffset);
      yOffset += 20;

      // Shear Force Diagram
      console.log('Generating shear force diagram');
      const shearForceCanvas = await html2canvas(document.querySelector('#shearForceDiagram') as HTMLElement);
      const shearForceImgData = shearForceCanvas.toDataURL('image/png');
      pdf.addImage(shearForceImgData, 'PNG', margin, yOffset, pageWidth - 2 * margin, 80);
      yOffset += 85;
      pdf.setFontSize(12);
      pdf.text('Figure 4.1: Shear Force Diagram', pageWidth / 2, yOffset, { align: 'center' });
      yOffset += 20;

      // Bending Moment Diagram
      console.log('Generating bending moment diagram');
      const bendingMomentCanvas = await html2canvas(document.querySelector('#bendingMomentDiagram') as HTMLElement);
      const bendingMomentImgData = bendingMomentCanvas.toDataURL('image/png');
      pdf.addImage(bendingMomentImgData, 'PNG', margin, yOffset, pageWidth - 2 * margin, 80);
      yOffset += 85;
      pdf.text('Figure 4.2: Bending Moment Diagram', pageWidth / 2, yOffset, { align: 'center' });

      console.log('Saving PDF');
      pdf.save('beam_analysis_report.pdf');
      console.log('PDF saved successfully');

    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Beam Load Calculator</h1>
        <Button onClick={handleDownloadPDF}>Download PDF Report</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Beam Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="beamType">Beam Type</Label>
                <Select value={beamType} onValueChange={setBeamType}>
                  <SelectTrigger id="beamType">
                    <SelectValue placeholder="Select beam type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simple Beam">Simple Beam</SelectItem>
                    <SelectItem value="Cantilever Beam">Cantilever Beam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="beamCrossSection">Beam Cross Section</Label>
                <Select value={beamCrossSection} onValueChange={setBeamCrossSection}>
                  <SelectTrigger id="beamCrossSection">
                    <SelectValue placeholder="Select beam cross section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rectangular">Rectangular</SelectItem>
                    <SelectItem value="I Beam">I Beam</SelectItem>
                    <SelectItem value="C Channel">C Channel</SelectItem>
                    <SelectItem value="Circular">Circular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="beamLength">Beam Length (mm)</Label>
                <Input
                  id="beamLength"
                  type="number"
                  value={beamLength}
                  onChange={(e) => setBeamLength(Number(e.target.value))}
                />
              </div>
              {beamType === 'Simple Beam' && (
                <>
                  <div>
                    <Label htmlFor="leftSupport">Left Support Position (mm)</Label>
                    <Input
                      id="leftSupport"
                      type="number"
                      value={leftSupport}
                      onChange={(e) => setLeftSupport(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rightSupport">Right Support Position (mm)</Label>
                    <Input
                      id="rightSupport"
                      type="number"
                      value={rightSupport}
                      onChange={(e) => setRightSupport(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Load Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Load Type</Label>
                <RadioGroup value={loadType} onValueChange={setLoadType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Point Load" id="pointLoad" />
                    <Label htmlFor="pointLoad">Point Load</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Uniform Load" id="uniformLoad" />
                    <Label htmlFor="uniformLoad">Uniform Load</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="loadMagnitude">Load Magnitude (N)</Label>
                <Input
                  id="loadMagnitude"
                  type="number"
                  value={loadMagnitude}
                  onChange={(e) => setLoadMagnitude(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="loadStartPosition">Load Start Position (mm)</Label>
                <Input
                  id="loadStartPosition"
                  type="number"
                  value={loadStartPosition}
                  onChange={(e) => setLoadStartPosition(Number(e.target.value))}
                />
              </div>
              {loadType === 'Uniform Load' && (
                <div>
                  <Label htmlFor="loadEndPosition">Load End Position (mm)</Label>
                  <Input
                    id="loadEndPosition"
                    type="number"
                    value={loadEndPosition}
                    onChange={(e) => setLoadEndPosition(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Material Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Select value={material} onValueChange={(value) => setMaterial(value as typeof material)}>
                  <SelectTrigger id="material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(standardMaterials).map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {material === 'Custom' && (
                <>
                  <div>
                    <Label htmlFor="yieldStrength">Yield Strength (MPa)</Label>
                    <Input
                      id="yieldStrength"
                      type="number"
                      value={customMaterial.yieldStrength}
                      onChange={(e) =>
                        setCustomMaterial({ ...customMaterial, yieldStrength: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="elasticModulus">Elastic Modulus (GPa)</Label>
                    <Input
                      id="elasticModulus"
                      type="number"
                      value={customMaterial.elasticModulus}
                      onChange={(e) =>
                        setCustomMaterial({ ...customMaterial, elasticModulus: Number(e.target.value) })
                      }
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="beamDensity">Beam Density (kg/m³)</Label>
                <Input
                  id="beamDensity"
                  type="number"
                  value={beamDensity}
                  onChange={(e) => setBeamDensity(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Beam Dimensions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {beamCrossSection === 'Rectangular' && (
                <>
                  <div>
                    <Label htmlFor="width">Width (mm)</Label>
                    <Input
                      id="width"
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Height (mm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
              {(beamCrossSection === 'I Beam' || beamCrossSection === 'C Channel') && (
                <>
                  <div>
                    <Label htmlFor="flangeWidth">Flange Width (mm)</Label>
                    <Input
                      id="flangeWidth"
                      type="number"
                      value={flangeWidth}
                      onChange={(e) => setFlangeWidth(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="flangeThickness">Flange Thickness (mm)</Label>
                    <Input
                      id="flangeThickness"
                      type="number"
                      value={flangeThickness}
                      onChange={(e) => setFlangeThickness(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="webThickness">Web Thickness (mm)</Label>
                    <Input
                      id="webThickness"
                      type="number"
                      value={webThickness}
                      onChange={(e) => setWebThickness(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Total Height (mm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
              {beamCrossSection === 'Circular' && (
                <div>
                  <Label htmlFor="diameter">Diameter (mm)</Label>
                  <Input
                    id="diameter"
                    type="number"
                    value={diameter}
                    onChange={(e) => setDiameter(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>Max Shear Force: {results.maxShearForce.toFixed(2)} N</p>
            <p>Max Bending Moment: {results.maxBendingMoment.toFixed(2)} N⋅m</p>
            <p>Max Normal Stress: {results.maxNormalStress.toFixed(2)} MPa</p>
            <p>Max Shear Stress: {results.maxShearStress.toFixed(2)} MPa</p>
            <p>Safety Factor: {results.safetyFactor.toFixed(2)}</p>
            <p>Center of Gravity: {results.centerOfGravity.toFixed(3)} m</p>
            <p>Moment of Inertia: {results.momentOfInertia.toFixed(6)} m⁴</p>
            <p>Section Modulus: {results.sectionModulus.toFixed(6)} m³</p>
            <p>Beam Weight: {beamWeight.toFixed(2)} N</p>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Beam Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <BeamDiagram
            beamLength={beamLength}
            leftSupport={leftSupport}
            rightSupport={rightSupport}
            loadType={loadType}
            loadStartPosition={loadStartPosition}
            loadEndPosition={loadEndPosition}
            loadMagnitude={loadMagnitude}
          />
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Shear Force Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="shearForceDiagram">
            <ChartContainer config={{ shearForce: { label: 'Shear Force', color: 'hsl(var(--chart-1))' } }} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shearForceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: 'Position (mm)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Shear Force (N)', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="y" name="Shear Force" stroke="var(--color-shearForce)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Bending Moment Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div id="bendingMomentDiagram">
            <ChartContainer config={{ bendingMoment: { label: 'Bending Moment', color: 'hsl(var(--chart-2))' } }} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bendingMomentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: 'Position (mm)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Bending Moment (N⋅mm)', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="y" name="Bending Moment" stroke="var(--color-bendingMoment)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}