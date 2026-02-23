import { View, Text } from 'react-native';
import { Colors } from '@/src/constants/colors';

export default function CreateNoteScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: Colors.textSecondary }}>Création de note — à venir</Text>
    </View>
  );
}
