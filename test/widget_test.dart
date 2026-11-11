import 'package:flutter_test/flutter_test.dart';

import 'package:ppr_watcher/main.dart';

void main() {
  test('ParkingFacility.fromJson feldolgozza az API válaszát', () {
    final pf = ParkingFacility.fromJson({
      'external_id': 'P061',
      'location_description': 'KÖKI Terminál P+R parkolóház',
      'capacity': 330,
      'free_capacity': 280,
      'opening_hours': '00:00-24:00',
    });

    expect(pf.id, 'P061');
    expect(pf.name, 'KÖKI Terminál P+R parkolóház');
    expect(pf.capacity, 330);
    expect(pf.free, 280);
    expect(pf.occupied, 50);
    expect(pf.freeRatio, closeTo(280 / 330, 1e-9));
  });

  test('szövegként érkező számokat is kezel', () {
    final pf = ParkingFacility.fromJson({
      'external_id': 'P051',
      'capacity': '206',
      'free_capacity': '184',
    });

    expect(pf.capacity, 206);
    expect(pf.free, 184);
    expect(pf.name, 'Ismeretlen parkoló');
  });
}
