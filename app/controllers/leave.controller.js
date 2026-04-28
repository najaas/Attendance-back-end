import Leave from '../models/leave.model.js';

export const getLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().sort({ fromDate: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status, adminNote, reviewedBy } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status, adminNote, reviewedBy, reviewedAt: new Date() },
      { returnDocument: 'after' }
    );
    res.json(leave);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteLeave = async (req, res) => {
  try {
    await Leave.findByIdAndDelete(req.params.id);
    res.json({ message: 'Leave request deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
