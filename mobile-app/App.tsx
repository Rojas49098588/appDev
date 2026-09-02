import { useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [submitted, setSubmitted] = useState<{ name: string; instrument: string } | null>(null);

  const handleSubmit = () => {
    setSubmitted({ name, instrument });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Instrument"
        value={instrument}
        onChangeText={setInstrument}
      />

      <Button title="Submit" onPress={handleSubmit} />

      {submitted && (
        <Text style={styles.confirmation}>
          Welcome, {submitted.name} — {submitted.instrument} player!
        </Text>
      )}

      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  confirmation: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});
