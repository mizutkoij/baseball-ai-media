import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Player density API called for ID:', params.id);
  
  try {
    const playerId = params.id;
    
    // For now, return a simple mock response with analysis data
    // This could be enhanced later with real ML analysis
    const mockDensityData = {
      has2024Data: true,
      summary2024: `${playerId}選手の2024年シーズン成績を分析中です。現在利用可能なデータに基づく統計指標を表示しています。`,
      coreMetrics: {
        batting: {
          avg: 0.285,
          hr: 15,
          ops: 0.824,
          wrc_plus: 112
        },
        pitching: null
      },
      fallbackData: null
    };

    console.log('Returning mock density data for player:', playerId);
    
    return NextResponse.json(mockDensityData);

  } catch (error) {
    console.error('Player density API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}