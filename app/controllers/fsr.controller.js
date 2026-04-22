import FSR from '../models/fsr.model.js';

export const saveFSR = async (req, res) => {
  try {
    const data = { ...req.body };
    if (!data.techName && req.user && req.user.name) {
      data.techName = req.user.name;
    }
    const newFsr = new FSR(data);
    await newFsr.save();
    res.status(201).json(newFsr);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save FSR', error: error.message });
  }
};

export const getFSRs = async (req, res) => {
  try {
    // 30 days logic is handled by TTL index dropping automatically.
    // However, just to be strictly bulletproof as requested, let's filter the DB query:
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fsrs = await FSR.find({ createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 });
    res.status(200).json(fsrs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get FSRs', error: error.message });
  }
};
export const updateFSR = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await FSR.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'FSR not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update FSR', error: error.message });
  }
};

export const deleteFSR = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FSR.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'FSR not found' });
    res.status(200).json({ message: 'FSR deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete FSR', error: error.message });
  }
};
