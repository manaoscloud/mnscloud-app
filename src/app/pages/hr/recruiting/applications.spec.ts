import { applicationPayload, ratingOf } from './applications';

describe('applicationPayload', () => {
  const file = new File(['%PDF-'], 'cv.pdf');
  const values = {
    openingUUID: '',
    name: ' Maria ',
    email: 'maria@example.com',
    file,
    stage: ' interview ',
    rating: '4',
    notes: ' good ',
    revision: '2',
  };

  it('update sends only revision, stage, rating and notes', () => {
    expect(applicationPayload(values, true)).toEqual({
      Revision: 2,
      Stage: 'interview',
      Rating: 4,
      Notes: 'good',
    });
  });

  it('create sends the candidate fields and the CV file', () => {
    const payload = applicationPayload(values, false);
    expect(payload['name']).toBe('Maria');
    expect(payload['openingUUID']).toBeNull();
    expect(payload['file']).toBe(file);
    expect('stage' in payload).toBeFalse();
  });

  it('accepts ratings from 1 to 5 only', () => {
    expect(ratingOf('')).toBeNull();
    expect(ratingOf(0)).toBeNull();
    expect(ratingOf(6)).toBeNull();
    expect(ratingOf(5)).toBe(5);
  });
});
