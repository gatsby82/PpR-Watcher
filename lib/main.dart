import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// A figyelt parkolók azonosítói (a kozutfigyelo.budapestkozut.hu `id` paramétere).
const List<String> watchedIds = ['P061', 'P051'];

/// Lekérdezési ciklus.
const Duration pollInterval = Duration(seconds: 10);

void main() => runApp(const PrApp());

// ---------------------------------------------------------------------------
// Modell
// ---------------------------------------------------------------------------

class ParkingFacility {
  final String id;
  final String name;
  final int capacity;
  final int free;
  final String? openingHours;
  final DateTime fetchedAt;

  const ParkingFacility({
    required this.id,
    required this.name,
    required this.capacity,
    required this.free,
    required this.fetchedAt,
    this.openingHours,
  });

  int get occupied => (capacity - free).clamp(0, capacity);
  double get freeRatio => capacity == 0 ? 0 : free / capacity;

  static int _toInt(dynamic v) =>
      v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;

  factory ParkingFacility.fromJson(Map<String, dynamic> j) => ParkingFacility(
        id: j['external_id']?.toString() ?? '?',
        name: j['location_description']?.toString() ?? 'Ismeretlen parkoló',
        capacity: _toInt(j['capacity']),
        free: _toInt(j['free_capacity']),
        openingHours: j['opening_hours']?.toString(),
        fetchedAt: DateTime.now(),
      );
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class KozutApi {
  static const _url = 'https://kozutfigyelo-back.budapestkozut.hu/api/ikszr/get';
  final http.Client _client;

  KozutApi([http.Client? client]) : _client = client ?? http.Client();

  Future<ParkingFacility> fetch(String id) async {
    final res = await _client
        .post(
          Uri.parse(_url),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'objectType': 'parking-facilities', 'externalId': id}),
        )
        .timeout(const Duration(seconds: 8));

    if (res.statusCode != 200) {
      throw Exception('HTTP ${res.statusCode}');
    }
    final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    final instance = body['data']?['instance'];
    if (body['success'] != true || instance == null) {
      throw Exception(body['message']?.toString().isNotEmpty == true
          ? body['message']
          : 'Hibás válasz');
    }
    return ParkingFacility.fromJson(instance as Map<String, dynamic>);
  }

  void dispose() => _client.close();
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

class PrApp extends StatelessWidget {
  const PrApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'P+R figyelő',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
        darkTheme: ThemeData(
          colorSchemeSeed: Colors.indigo,
          brightness: Brightness.dark,
          useMaterial3: true,
        ),
        home: const MonitorPage(),
      );
}

class MonitorPage extends StatefulWidget {
  const MonitorPage({super.key});

  @override
  State<MonitorPage> createState() => _MonitorPageState();
}

class _MonitorPageState extends State<MonitorPage> with WidgetsBindingObserver {
  final _api = KozutApi();
  final Map<String, ParkingFacility> _data = {};
  final Map<String, String> _errors = {};
  final Map<String, int> _delta = {}; // változás az előző lekérdezéshez képest
  Timer? _timer;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _api.dispose();
    super.dispose();
  }

  // Háttérben nem kérdezünk (akku + adatforgalom), előtérbe jövéskor azonnal frissít.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _start();
    } else if (state == AppLifecycleState.paused) {
      _timer?.cancel();
    }
  }

  void _start() {
    _timer?.cancel();
    _refresh();
    _timer = Timer.periodic(pollInterval, (_) => _refresh());
  }

  Future<void> _refresh() async {
    if (_loading) return; // ne fusson két lekérdezés egymásra
    setState(() => _loading = true);

    await Future.wait(watchedIds.map((id) async {
      try {
        final pf = await _api.fetch(id);
        final prev = _data[id];
        if (prev != null && prev.free != pf.free) {
          _delta[id] = pf.free - prev.free;
        }
        _data[id] = pf;
        _errors.remove(id);
      } catch (e) {
        _errors[id] = e.toString();
      }
    }));

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('P+R parkolók'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _loading
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : IconButton(
                    icon: const Icon(Icons.refresh),
                    tooltip: 'Frissítés',
                    onPressed: _refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            for (final id in watchedIds)
              ParkingCard(
                id: id,
                facility: _data[id],
                error: _errors[id],
                delta: _delta[id],
              ),
            const SizedBox(height: 8),
            Text(
              'Automatikus frissítés ${pollInterval.inSeconds} mp-enként • '
              'Forrás: Budapest Közút Közútfigyelő',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class ParkingCard extends StatelessWidget {
  final String id;
  final ParkingFacility? facility;
  final String? error;
  final int? delta;

  const ParkingCard({
    super.key,
    required this.id,
    this.facility,
    this.error,
    this.delta,
  });

  Color _statusColor(double ratio) {
    if (ratio <= 0) return Colors.red;
    if (ratio < 0.25) return Colors.orange;
    return Colors.green;
  }

  String _hhmmss(DateTime t) =>
      '${t.hour.toString().padLeft(2, '0')}:'
      '${t.minute.toString().padLeft(2, '0')}:'
      '${t.second.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pf = facility;

    if (pf == null) {
      return Card(
        child: ListTile(
          title: Text(id),
          subtitle: Text(error ?? 'Betöltés...'),
          leading: error == null
              ? const CircularProgressIndicator()
              : const Icon(Icons.error_outline, color: Colors.red),
        ),
      );
    }

    final color = _statusColor(pf.freeRatio);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(Icons.local_parking, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(pf.name,
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600)),
              ),
              Text(pf.id, style: theme.textTheme.labelSmall),
            ]),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${pf.free}',
                    style: theme.textTheme.displayMedium
                        ?.copyWith(color: color, fontWeight: FontWeight.bold)),
                Padding(
                  padding: const EdgeInsets.only(bottom: 10, left: 6),
                  child: Text('/ ${pf.capacity} szabad',
                      style: theme.textTheme.titleMedium),
                ),
                const Spacer(),
                if (delta != null && delta != 0)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      delta! > 0 ? '▲ +$delta' : '▼ $delta',
                      style: TextStyle(
                        color: delta! > 0 ? Colors.green : Colors.red,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: pf.capacity == 0 ? 0 : pf.occupied / pf.capacity,
                minHeight: 10,
                color: color,
                backgroundColor: color.withValues(alpha: 0.15),
              ),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Text(
                'Telítettség: ${((1 - pf.freeRatio) * 100).round()}%',
                style: theme.textTheme.bodySmall,
              ),
              const Spacer(),
              Text('Frissítve: ${_hhmmss(pf.fetchedAt)}',
                  style: theme.textTheme.bodySmall),
            ]),
            if (error != null) ...[
              const SizedBox(height: 6),
              Text('Utolsó lekérdezés sikertelen – régi adat látszik',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.orange)),
            ],
          ],
        ),
      ),
    );
  }
}
