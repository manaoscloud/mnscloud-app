import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { niceMax, TrendChartComponent, type TrendPoint } from './trend-chart';

describe('TrendChartComponent', () => {
  let fixture: ComponentFixture<TrendChartComponent>;
  const points: TrendPoint[] = [
    { day: '2026-10-17', values: { opened: 2, resolved: 1 } },
    { day: '2026-10-18', values: { opened: 0 } },
    { day: '2026-10-19', values: { opened: 7, resolved: 3 } },
  ];

  function render(
    kind: 'bars' | 'stacked' | 'line',
    series = [
      { key: 'opened', label: 'Opened' },
      { key: 'resolved', label: 'Resolved' },
    ],
  ) {
    fixture.componentRef.setInput('title', 'Tickets');
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('series', series);
    fixture.componentRef.setInput('points', points);
    fixture.componentRef.setInput('language', 'pt-BR');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TrendChartComponent, TranslocoTestingModule.forRoot({ langs: { en: {} } })],
    });
    fixture = TestBed.createComponent(TrendChartComponent);
  });

  it('rounds the axis to clean numbers', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(2100)).toBe(2500);
  });

  it('stacks series against the summed peak and labels three days', () => {
    const element = render('stacked');
    const component = fixture.componentInstance;
    expect(component.yMax()).toBe(10);
    expect(component.columns()[2].segments.map((segment) => segment.percent)).toEqual([30, 70]);
    expect(component.xLabels()).toEqual(['17/10', '18/10', '19/10']);
    expect(element.querySelectorAll('.mns-trend-legend-item').length).toBe(2);
    expect(element.querySelectorAll('.mns-trend-sr li').length).toBe(3);
  });

  it('draws one polyline per series for lines and treats missing values as zero', () => {
    const element = render('line');
    expect(fixture.componentInstance.yMax()).toBe(10);
    expect(element.querySelectorAll('polyline').length).toBe(2);
    expect(fixture.componentInstance.columns()[1].values[1].raw).toBe(0);
  });

  it('omits the legend for a single series and shows a tooltip on hover', () => {
    const element = render('bars', [{ key: 'opened', label: 'Opened' }]);
    expect(element.querySelector('.mns-trend-legend')).toBeNull();
    fixture.componentInstance.hovered.set(2);
    fixture.detectChanges();
    expect(element.querySelector('.mns-trend-tooltip')?.textContent).toContain('7');
  });
});
